/**
 * Runtime configuration for the ReLoop AI frontend.
 * apiBase points at the UPS ReLoop Nexus .NET API.
 * The backend already whitelists http://localhost:4200 via CORS.
 */
export const environment = {
  production: false,
  apiBase: 'http://localhost:5080/api',
};
