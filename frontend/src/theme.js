import { createTheme, alpha } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00b8ff', dark: '#0099d4', contrastText: '#000' },
    secondary: { main: '#ff4081' },
    background: { default: '#0a0a0a', paper: '#1a1a1a' },
    divider: '#2a2a2a',
    text: { primary: '#ffffff', secondary: '#888888' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 8 },
        containedPrimary: { color: '#000' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { backgroundImage: 'none', border: '1px solid #2a2a2a' },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& fieldset': { borderColor: '#2a2a2a' },
          '&:hover fieldset': { borderColor: '#444' },
        },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: '#2a2a2a' } } },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: '#111111', borderRight: '1px solid #2a2a2a' } },
    },
  },
});
