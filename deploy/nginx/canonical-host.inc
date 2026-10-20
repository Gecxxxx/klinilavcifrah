# Include inside the existing HTTPS server {} that serves both the apex and www.
# Keep the existing TLS certificate, document root and /api/ proxy configuration.
# Verify that the certificate covers www before enabling its HTTPS redirect.
if ($host = www.klinikavcifrah.ru) {
    return 308 https://klinikavcifrah.ru$request_uri;
}
