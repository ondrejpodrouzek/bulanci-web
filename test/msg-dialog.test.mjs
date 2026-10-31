import test from 'node:test';
import assert from 'node:assert/strict';
import {duplicateName,nameUsedText} from '../dist/ui/msg-dialog.js';

test('Start hry 2 refuses two players of the same name (0x40f610)', () => {
  assert.equal(duplicateName(['Žezlík','Kapslík']),null);
  assert.equal(duplicateName(['Žezlík','Kapslík','Žezlík']),'Žezlík');
  assert.equal(duplicateName(['bob','Bob']),null,'the comparison is case-sensitive');
  assert.equal(duplicateName(['A','B','B'],0,1),null,'only names on this computer are checked');
  assert.equal(nameUsedText('Uhlík'),'Jméno "Uhlík" je již použito.');
});
