"""Publish an already signed local APK. This script never reads a signing key."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def main():
    root=Path(__file__).resolve().parent.parent
    repository=sys.argv[1] if len(sys.argv)>1 else 'daisy169903-stack/language-app'
    if not re.fullmatch(r'[A-Za-z0-9-]+/[A-Za-z0-9_.-]+',repository):
        raise ValueError('Invalid repository')
    version=json.loads((root/'package.json').read_text(encoding='utf-8'))['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+',version):
        raise ValueError('Stable version required')
    apk=root/'release/VietLingo-HU-Android.apk'
    contents=apk.read_bytes()
    env={**os.environ,'GIT_TERMINAL_PROMPT':'0','GCM_INTERACTIVE':'Never'}
    credential=subprocess.run(['git','-c','credential.interactive=false','credential','fill'],input=f'protocol=https\nhost=github.com\npath={repository}.git\n\n',text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env)
    if credential.returncode:raise ValueError('Git credential unavailable')
    values=dict(line.split('=',1) for line in credential.stdout.splitlines() if '=' in line)
    token=values.get('password')
    if not token:raise ValueError('Git credential unavailable')
    opener=urllib.request.build_opener(NoRedirect())
    def request(url,method='GET',data=None,raw=False):
        headers={'Authorization':f'Bearer {token}','Accept':'application/vnd.github+json','User-Agent':'VietLingo-release-publisher','Content-Type':'application/vnd.android.package-archive' if raw else 'application/json'}
        body=data if raw else json.dumps(data).encode() if data is not None else None
        with opener.open(urllib.request.Request(url,data=body,method=method,headers=headers),timeout=90) as response:
            return json.loads(response.read())
    base=f'https://api.github.com/repos/{repository}/releases'
    tag='v'+version
    try:
        release=request(base+'/tags/'+tag)
    except urllib.error.HTTPError as error:
        if error.code!=404:raise
        release=request(base,'POST',{'tag_name':tag,'target_commitish':'main','name':'VietLingo HU '+tag,'draft':True,'prerelease':False,'body':'All three first-lesson expressions now have online audio without importing a pack: chào and cảm ơn from the original Northern podcast, and tạm biệt from the public VietnamesePod101 vocabulary recording (publisher identifies its main course as Northern). Internet is required. Timing is automatic, not native-speaker approval. Approved imported recordings still take priority offline. No podcast media is bundled in the APK. Token-free GitHub updates remain available. Existing learning progress and imported audio are preserved when updating with the same signing identity. APK SHA256: '+hashlib.sha256(contents).hexdigest()})
    if any(a.get('name')=='VietLingo-HU-Android.apk' for a in release.get('assets',[])):
        asset=next(a for a in release['assets'] if a['name']=='VietLingo-HU-Android.apk')
        expected=f'https://github.com/{repository}/releases/download/{tag}/VietLingo-HU-Android.apk'
        if asset['browser_download_url']!=expected or release.get('draft'):raise ValueError('Release is not ready for the app updater')
        print(json.dumps({'url':release['html_url'],'asset_url':asset['browser_download_url'],'size':asset['size'],'tag':release['tag_name'],'existing_asset_preserved':True}));return
    upload=f'https://uploads.github.com/repos/{repository}/releases/{int(release["id"])}/assets?name=VietLingo-HU-Android.apk'
    asset=request(upload,'POST',contents,True)
    if int(asset['size'])!=len(contents):raise ValueError('Uploaded APK size mismatch')
    if release.get('draft'):
        release=request(base+'/'+str(release['id']),'PATCH',{'draft':False,'make_latest':'true'})
    release=request(base+'/tags/'+tag)
    asset=next(a for a in release['assets'] if a['name']=='VietLingo-HU-Android.apk')
    print(json.dumps({'url':release['html_url'],'asset_url':asset['browser_download_url'],'size':asset['size'],'sha256':hashlib.sha256(contents).hexdigest(),'signing_key_transmitted':False}))

if __name__=='__main__':
    try:main()
    except urllib.error.HTTPError as error:
        print(f'GitHub release API failed (HTTP {error.code}); no credentials printed.',file=sys.stderr);sys.exit(1)
    except Exception as error:
        print(f'Local release publication failed: {type(error).__name__}; no credentials printed.',file=sys.stderr);sys.exit(1)
