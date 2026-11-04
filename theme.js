/* Editor appearance is a device preference, independent of the exported design. */
(function(){
    'use strict';
    const key='tdab.appearance';
    const system=window.matchMedia('(prefers-color-scheme: dark)');
    let saved=null;
    try{saved=localStorage.getItem(key)??localStorage.getItem('tinydesk-studio-appearance');}catch(e){/* file:// storage can be disabled. */}
    let explicit=saved==='dark'||saved==='light';
    function apply(theme){
        document.documentElement.dataset.uiTheme=theme;
        const button=document.getElementById('editorTheme');
        if(!button)return;
        const dark=theme==='dark';
        button.textContent=dark?'☀ Light mode':'☾ Dark mode';
        button.setAttribute('aria-pressed',String(dark));
        button.setAttribute('aria-label',dark?'Use light editor theme':'Use dark editor theme');
        button.title=dark?'Switch the editor to light mode':'Switch the editor to dark mode';
    }
    // Apply before the stylesheet and first paint to avoid a light-theme flash.
    apply(explicit?saved:system.matches?'dark':'light');
    document.addEventListener('DOMContentLoaded',()=>{
        apply(document.documentElement.dataset.uiTheme);
        document.getElementById('editorTheme').addEventListener('click',()=>{
            const theme=document.documentElement.dataset.uiTheme==='dark'?'light':'dark';
            explicit=true;
            apply(theme);
            try{localStorage.setItem(key,theme);}catch(e){/* Keep the session choice. */}
        });
    });
    system.addEventListener('change',e=>{if(!explicit)apply(e.matches?'dark':'light');});
})();
