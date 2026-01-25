#!/bin/sh
set -e

# Strip protocol (http://, https://) and port from DOMAIN if present
# e.g., "https://foobar:443" -> "foobar"
CLEAN_DOMAIN=$(echo "${DOMAIN}" | sed -e 's|^[^/]*//||' -e 's|:.*$||')

# Export for envsubst
export DOMAIN="${CLEAN_DOMAIN}"

# Substitute environment variables in nginx config template
envsubst '${DOMAIN}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start nginx
exec nginx -g "daemon off;"
