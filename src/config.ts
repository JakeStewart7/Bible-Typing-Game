export type AppConfig = {
  isDevelopment: boolean;
};

export const appConfig: AppConfig = {
  isDevelopment: import.meta.env.DEV
};

