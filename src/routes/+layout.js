// La app se ejecuta solo en el cliente (SPA), requisito para empaquetarla
// con Capacitor dentro de un APK de Android.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
