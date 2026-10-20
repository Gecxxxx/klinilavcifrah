#!/usr/bin/env bash
# One-time setup, run by root with the PUBLIC deployment key file as argument.
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
public_key=${1:?Usage: bash setup-vps.sh /tmp/kvc-deploy.pub}
[[ -f "$public_key" ]] || { echo 'Public key file missing'; exit 1; }
[[ $(wc -l < "$public_key") -le 1 ]] || { echo 'Expected one public key'; exit 1; }
ssh-keygen -lf "$public_key"
key=$(tr -d '\r' < "$public_key")
[[ "$key" != *$'\n'* && "$key" != *$'\r'* ]] || { echo 'Expected exactly one key line'; exit 1; }
[[ "$key" == ssh-ed25519\ * ]] || { echo 'Expected an Ed25519 public key'; exit 1; }
site=/var/www/klinikavcifrah
[[ -L "$site/current" && -d "$site/releases" ]] || { echo 'Unexpected site layout'; exit 1; }
case $(readlink -f "$site/current") in "$site/releases/"*) ;; *) echo 'Unexpected current target'; exit 1 ;; esac
if ! id kvc-deploy >/dev/null 2>&1; then
    useradd --create-home --user-group --shell /bin/bash kvc-deploy
fi
[[ $(id -u kvc-deploy) != 0 ]] || { echo 'Refusing a root deployment account'; exit 1; }
install -d -o kvc-deploy -g kvc-deploy -m 700 /home/kvc-deploy/.ssh
install -d -o kvc-deploy -g kvc-deploy -m 700 /home/kvc-deploy/incoming
touch /home/kvc-deploy/.ssh/authorized_keys
entry="restrict $key"
if ! grep -Fqx "$entry" /home/kvc-deploy/.ssh/authorized_keys; then
    printf '\n%s\n' "$entry" >> /home/kvc-deploy/.ssh/authorized_keys
fi
chown kvc-deploy:kvc-deploy /home/kvc-deploy/.ssh/authorized_keys
chmod 600 /home/kvc-deploy/.ssh/authorized_keys
# Only these two directory entries; never recursively chown other sites/releases.
chown kvc-deploy:kvc-deploy "$site" "$site/releases"
chmod 755 "$site" "$site/releases"
echo 'Deployment account ready. No sudo access was granted.'
printf '89.124.104.188 '
cat /etc/ssh/ssh_host_ed25519_key.pub
