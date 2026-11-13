/** Same normalisation as backend/app/services/merchants.py: case/punctuation-insensitive, exact match only. */
export const normalizeName = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, ' ').trim()
