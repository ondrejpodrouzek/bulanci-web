// CSetupDlg (constructor 0x40e290): window 290x140, one balance slider between music and effects.
// CVolume (0x40e1b0) spans (25,42)-(270,·), range -50..50; text 0x170 shows 50-v % music and
// 50+v % effects (0x40e4e0). Every change is heard at once (0x40e5b0 -> 0x4223e0); holding the
// slider loops effect 4/30 (0x40fb00) until release (0x40e230). Ok keeps the value, Zrušit
// restores the stored one (0x402379).
import {StaticText,ScrollBar,Button,Window} from './widgets.js';

export const balanceText=v=>`Vyvážení: ${50-v}% hudby a ${50+v}% efektů`;

export function setupDialog({balance=0,onChange=()=>{},onPreview=()=>{},onPreviewEnd=()=>{}}) {
  const label=new StaticText({x:25,y:20,text:balanceText(balance),spacing:1});
  const slider=new ScrollBar({x:25,y:42,w:245,min:-50,max:50,value:balance,arrow:[16,15],
    images:[[114,113,115],[131,129,133],[126,125,127]],
    onChange:v=>{label.text=balanceText(v);onChange(v);},onPress:onPreview,onRelease:onPreviewEnd});
  const win=new Window({w:290,h:140,widgets:[label,slider,
    new Button({x:55,y:90,text:'Ok',onClick:()=>win.onOk()}),
    new Button({x:155,y:90,text:'Zrušit',onClick:()=>win.onCancel()})]});
  win.onOk=()=>({balance:slider.value});
  win.onCancel=()=>{onChange(balance);return null;};
  return win;
}
