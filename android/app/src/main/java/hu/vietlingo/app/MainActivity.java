package hu.vietlingo.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.Context;
import java.security.KeyStore;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Versions through 0.3 used an optional updater credential. It is obsolete.
        getSharedPreferences("secure-updates", Context.MODE_PRIVATE).edit().clear().apply();
        try {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            if (store.containsAlias("hu.vietlingo.app.github-updates")) {
                store.deleteEntry("hu.vietlingo.app.github-updates");
            }
        } catch (Exception ignored) {
            // Credential cleanup must not prevent offline lessons from launching.
        }
    }
}
