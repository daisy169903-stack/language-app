package hu.vietlingo.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** GitHub credential is encrypted at rest by a non-exportable Android Keystore key. */
@CapacitorPlugin(name="SecureUpdates")
public class SecureUpdatesPlugin extends Plugin {
    private static final String ALIAS="hu.vietlingo.app.github-updates";
    private SharedPreferences preferences(){return getContext().getSharedPreferences("secure-updates",Context.MODE_PRIVATE);}
    private SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(!store.containsAlias(ALIAS)){
            KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            return generator.generateKey();
        }
        return (SecretKey)store.getKey(ALIAS,null);
    }
    @PluginMethod public void getToken(PluginCall call){
        try{
            String encrypted=preferences().getString("token",null);JSObject result=new JSObject();
            if(encrypted==null){result.put("value","");call.resolve(result);return;}
            String iv=preferences().getString("iv",null);if(iv==null)throw new IllegalStateException();
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(iv,Base64.NO_WRAP)));
            result.put("value",new String(cipher.doFinal(Base64.decode(encrypted,Base64.NO_WRAP)),StandardCharsets.UTF_8));
            call.resolve(result);
        }catch(Exception ignored){call.reject("A GitHub-token nem olvasható. Add meg újra a Profil képernyőn.");}
    }
    @PluginMethod public void setToken(PluginCall call){
        String value=call.getString("value");
        if(value==null||value.length()>1024||value.contains("\n")||value.contains("\r")){call.reject("Érvénytelen token.");return;}
        try{
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
            byte[] encrypted=cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            boolean saved=preferences().edit().putString("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP))
                .putString("token",Base64.encodeToString(encrypted,Base64.NO_WRAP)).commit();
            if(!saved)throw new IllegalStateException();call.resolve();
        }catch(Exception ignored){call.reject("A GitHub-token nem menthető.");}
    }
    @PluginMethod public void clearToken(PluginCall call){
        if(preferences().edit().clear().commit())call.resolve();else call.reject("A token nem törölhető.");
    }
}
