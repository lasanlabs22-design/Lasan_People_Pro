// The white theme is the default; the black one is remembered per browser under this key. The root
// layout runs THEME_SCRIPT before the first paint, so a black page never flashes white.
export const THEME_KEY = "lasan-theme";
export const THEME_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;
