import { expect, test } from 'bun:test'
import { venueMark } from '../src/components/NoPhotoFace'
test('venue imprint uses only actual venue words, with safe missing/Unicode cases', () => {
  expect(venueMark('  H’ART Museum ')).toBe('HM')
  expect(venueMark('Grachtenmuseum')).toBe('G')
  expect(venueMark('')).toBe('')
  expect(venueMark('Één podium')).toBe('ÉP')
})
