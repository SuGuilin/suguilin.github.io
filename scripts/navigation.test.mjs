import test from 'node:test';
import assert from 'node:assert/strict';
import {bindMobileNavigation} from '../assets/navigation.js';

function fixture(mobile=true){
  const document={activeElement:null,listeners:new Map(),addEventListener(name,fn){this.listeners.set(name,fn);},key(key,shiftKey=false){const event={key,shiftKey,preventDefault(){this.prevented=true;}};this.listeners.get('keydown')(event);return event;}};
  function element(){
    const attributes=new Map(),classes=new Set(),events=new Map();
    return {attributes,classes,classList:{toggle(name,value){value?classes.add(name):classes.delete(name);}},toggleAttribute(name,value){value?attributes.set(name,''):attributes.delete(name);},setAttribute(name,value){attributes.set(name,value);},removeAttribute(name){attributes.delete(name);},addEventListener(name,fn){events.set(name,fn);},click(){events.get('click')?.();},focus(){document.activeElement=this;},getClientRects(){return [1];}};
  }
  const sidebar=element(),button=element(),closeButton=element(),scrim=element(),mainShell=element(),body=element(),first=element(),active=element(),last=element();
  const items=[first,closeButton,active,last];sidebar.querySelectorAll=()=>items;sidebar.querySelector=()=>active;sidebar.contains=el=>items.includes(el);
  const media={matches:mobile,addEventListener(name,fn){this.change=fn;},resize(value){this.matches=value;this.change();}};
  const navigation=bindMobileNavigation({sidebar,button,closeButton,scrim,mainShell,body,document,media});
  return {navigation,sidebar,button,closeButton,scrim,mainShell,body,document,media,first,active,last};
}

test('Closed mobile navigation removes hidden links from focus and accessibility while keeping the page usable',()=>{
  const f=fixture();assert.equal(f.sidebar.attributes.get('inert'),'');assert.equal(f.sidebar.attributes.get('aria-hidden'),'true');
  assert.equal(f.button.attributes.get('aria-expanded'),'false');assert.equal(f.scrim.hidden,true);
  assert.equal(f.mainShell.attributes.has('inert'),false);assert.equal(f.navigation.isOpen,false);
});

test('Opening navigation focuses the current page; Tab stays in the menu and Escape restores the trigger',()=>{
  const f=fixture();f.button.click();assert.equal(f.document.activeElement,f.active);
  assert.equal(f.mainShell.attributes.has('inert'),true);assert.equal(f.sidebar.attributes.get('aria-modal'),'true');
  f.last.focus();assert.equal(f.document.key('Tab').prevented,true);assert.equal(f.document.activeElement,f.first);
  assert.equal(f.document.key('Tab',true).prevented,true);assert.equal(f.document.activeElement,f.last);
  assert.equal(f.document.key('Escape').prevented,true);assert.equal(f.document.activeElement,f.button);
  assert.equal(f.mainShell.attributes.has('inert'),false);assert.equal(f.sidebar.attributes.has('inert'),true);
});

test('Close controls release the background; navigation can close without forcing focus back before changing page',()=>{
  const f=fixture();f.button.click();f.closeButton.click();assert.equal(f.document.activeElement,f.button);
  f.button.click();f.scrim.click();assert.equal(f.navigation.isOpen,false);
  f.button.click();f.navigation.close({restoreFocus:false});assert.equal(f.document.activeElement,f.active);
  assert.equal(f.mainShell.attributes.has('inert'),false);assert.equal(f.scrim.hidden,true);
});

test('Crossing the mobile breakpoint restores desktop navigation and never strands focus in a hidden menu',()=>{
  const f=fixture();f.button.click();f.media.resize(false);
  assert.equal(f.sidebar.attributes.has('inert'),false);assert.equal(f.sidebar.attributes.has('aria-hidden'),false);
  assert.equal(f.sidebar.attributes.has('aria-modal'),false);assert.equal(f.mainShell.attributes.has('inert'),false);
  assert.equal(f.navigation.isOpen,false);assert.equal(f.body.classes.has('navigation-open'),false);
  f.active.focus();f.media.resize(true);assert.equal(f.document.activeElement,f.button);assert.equal(f.sidebar.attributes.has('inert'),true);
  f.media.resize(false);assert.equal(f.document.activeElement,f.active);
  f.media.resize(true);f.button.click();f.closeButton.focus();f.media.resize(false);assert.equal(f.document.activeElement,f.active);
});
