// Global type declarations for the client-side environment

declare const window: {
  localStorage: Storage;
  location: {
    search: string;
    pathname: string;
  };
  [key: string]: any;
};

declare const HeadersInit: any;