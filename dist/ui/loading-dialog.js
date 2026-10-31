// CLoadingLevel (constructor 0x40dfb0): window 250x75 on the screen centre while the game view
// reads the level file (0x41d3e1); the bar follows the bytes read in 16 kB steps. On the web
// it follows the level's pictures.
import {StaticText,ProgressBar,Window} from './widgets.js';

export function loadingDialog() {
  const bar=new ProgressBar({x:20,y:50,w:250-20-20,h:5});
  const win=new Window({w:250,h:75,widgets:[new StaticText({x:20,y:20,text:'Načítá se level...',font:174,spacing:2}),bar]});
  win.progress=(value,max)=>{bar.value=value;bar.max=max;};
  win.onCancel=null;
  return win;
}
