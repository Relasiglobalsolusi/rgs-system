/** Blocking script for <head> — applies theme class before hydration (FOUC-safe). */
export function getThemeInitScript(): string {
  return `(function(){try{var d=document.documentElement;var v=null;var m=document.cookie.match(/(?:^|; )rgs-theme=([^;]*)/);if(m)v=decodeURIComponent(m[1]);if(v!=="light"&&v!=="dark"){try{v=localStorage.getItem("rgs-theme")}catch(e){}}if(v!=="light"&&v!=="dark")v="dark";if(v==="light"){d.classList.remove("dark");d.style.colorScheme="light"}else{d.classList.add("dark");d.style.colorScheme="dark"}}catch(e){}})();`;
}
