import { create } from 'zustand'

type ScannerState = {
  paletteOpen: boolean
  scannerOpen: boolean
  openPalette: () => void
  closePalette: () => void
  openScanner: () => void
  closeScanner: () => void
}

/** Shared open/close state for the command palette and the camera scanner. */
export const useScanner = create<ScannerState>((set) => ({
  paletteOpen: false,
  scannerOpen: false,
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  openScanner: () => set({ scannerOpen: true }),
  closeScanner: () => set({ scannerOpen: false }),
}))
