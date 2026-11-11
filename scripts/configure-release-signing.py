"""Store the existing Android signing key as an encrypted GitHub Actions secret.

Uses the already configured Git credential helper. Never prints credentials/key bytes.
Requires PyNaCl only for this one-time developer setup, not for the app.
"""
import base64
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request
from nacl.public import PublicKey, SealedBox

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def main():
    repository = sys.argv[1] if len(sys.argv) > 1 else 'daisy169903-stack/language-app'
    if not re.fullmatch(r'[A-Za-z0-9-]+/[A-Za-z0-9_.-]+', repository):
        raise ValueError('Invalid repository')
    root = Path(__file__).resolve().parent.parent
    key = root / '.android-tools/debug.keystore'
    if not key.is_file():
        raise ValueError('Original installed-app signing key is missing')
    environment = {**os.environ, 'GIT_TERMINAL_PROMPT': '0', 'GCM_INTERACTIVE': 'Never'}
    result = subprocess.run(['git', '-c', 'credential.interactive=false', 'credential', 'fill'],
        input=f'protocol=https\nhost=github.com\npath={repository}.git\n\n', text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=environment, check=False)
    if result.returncode:
        raise ValueError('GitHub Git credential is unavailable; use repository Actions secret settings manually')
    credentials = dict(line.split('=', 1) for line in result.stdout.splitlines() if '=' in line)
    token = credentials.get('password')
    if not token:
        raise ValueError('GitHub Git credential is unavailable')
    base = f'https://api.github.com/repos/{repository}/actions/secrets'
    def request(url, method='GET', data=None):
        headers = {'Authorization': f'Bearer {token}', 'Accept':'application/vnd.github+json',
            'User-Agent':'VietLingo-release-setup', 'Content-Type':'application/json'}
        body = json.dumps(data).encode() if data is not None else None
        with urllib.request.build_opener(NoRedirect()).open(urllib.request.Request(url, data=body, headers=headers, method=method), timeout=20) as response:
            contents = response.read()
            return json.loads(contents) if contents else {}
    try:
        request(base + '/ANDROID_KEYSTORE_BASE64')
        print('Existing ANDROID_KEYSTORE_BASE64 preserved; its value cannot be read back.')
        return
    except urllib.error.HTTPError as error:
        if error.code != 404:
            raise ValueError(f'GitHub secret metadata request failed (HTTP {error.code})') from None
    public = request(base + '/public-key')
    encrypted = SealedBox(PublicKey(base64.b64decode(public['key']))).encrypt(base64.b64encode(key.read_bytes()))
    request(base + '/ANDROID_KEYSTORE_BASE64', 'PUT', {'encrypted_value':base64.b64encode(encrypted).decode(), 'key_id':public['key_id']})
    metadata = request(base + '/ANDROID_KEYSTORE_BASE64')
    print(json.dumps({'secret':metadata['name'], 'configured':True, 'repository':repository}))

if __name__ == '__main__':
    try:
        main()
    except urllib.error.HTTPError as error:
        print(f'GitHub API permission/setup failed (HTTP {error.code}); no credentials printed.', file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        # Do not include exception payloads that could contain request/credential content.
        print(f'Release signing setup failed: {type(error).__name__}. Existing local key is unchanged.', file=sys.stderr)
        sys.exit(1)
