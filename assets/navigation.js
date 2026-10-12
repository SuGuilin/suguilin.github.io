export function bindMobileNavigation({sidebar,button,closeButton,scrim,mainShell,body,document,media}){
  let open=false;
  const focusable=()=>[...sidebar.querySelectorAll('a[href],button:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length);
  function apply(){
    const modal=media.matches&&open;
    sidebar.classList.toggle('open',modal);
    sidebar.toggleAttribute('inert',media.matches&&!modal);
    if(media.matches&&!modal)sidebar.setAttribute('aria-hidden','true');else sidebar.removeAttribute('aria-hidden');
    if(modal){sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');}
    else{sidebar.removeAttribute('role');sidebar.removeAttribute('aria-modal');}
    mainShell.toggleAttribute('inert',modal);
    body.classList.toggle('navigation-open',modal);
    scrim.hidden=!modal;
    button.setAttribute('aria-expanded',String(modal));
  }
  function close({restoreFocus=true}={}){
    const wasOpen=media.matches&&open;open=false;apply();
    if(wasOpen&&restoreFocus)button.focus({preventScroll:true});
  }
  function show(){
    if(!media.matches)return;
    open=true;apply();
    (sidebar.querySelector('[data-route].active')||closeButton).focus({preventScroll:true});
  }
  button.addEventListener('click',()=>open?close():show());
  closeButton.addEventListener('click',()=>close());
  scrim.addEventListener('click',()=>close());
  document.addEventListener('keydown',event=>{
    if(!media.matches||!open)return;
    if(event.key==='Escape'){event.preventDefault();close();return;}
    if(event.key!=='Tab')return;
    const items=focusable(),first=items[0],last=items.at(-1);
    if(!first)return;
    if(event.shiftKey&&(document.activeElement===first||!sidebar.contains(document.activeElement))){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!sidebar.contains(document.activeElement))){event.preventDefault();first.focus();}
  });
  media.addEventListener('change',()=>{const focused=sidebar.contains(document.activeElement),mobileControl=document.activeElement===button||document.activeElement===closeButton;open=false;apply();if(media.matches&&focused)button.focus({preventScroll:true});else if(!media.matches&&mobileControl)(sidebar.querySelector('[data-route].active')||focusable()[0])?.focus({preventScroll:true});});
  apply();
  return {close,get isOpen(){return media.matches&&open;}};
}
