/** Blocking script — sets <html lang> from cookie (SSR) then localStorage before paint. */
export function getLocaleInitScript(): string {
  return `(function(){try{var d=document.documentElement;var v=null;var m=document.cookie.match(/(?:^|; )rgs-locale=([^;]*)/);if(m)v=decodeURIComponent(m[1]);if(v!=="en"&&v!=="id"){try{v=localStorage.getItem("rgs-locale")}catch(e){}}if(v!=="en"&&v!=="id")v="en";d.lang=v}catch(e){}})();`;
}
