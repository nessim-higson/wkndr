import { createContext } from 'react'
import { FACE_FALLBACK, type HouseMove } from './house-face'

/** Which no-photo face the deck is wearing, and — for the house face — the move each card was
 *  dealt. App provides it around the stack; a Card rendered outside it gets the shipped glass. */
export const FaceContext = createContext<{ face: string; moves: ReadonlyMap<string, HouseMove> }>({ face: FACE_FALLBACK, moves: new Map() })
