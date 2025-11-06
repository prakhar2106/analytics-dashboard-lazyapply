import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import JobLinks from './components/JobLinks'
import JobSearchAnalytics from './components/JobSearchAnalytics'
import Login from './components/Login'

const DRAWER_WIDTH = 240

interface ProtectedRouteProps {
  children: React.ReactNode
  isAuthenticated: boolean
}

function ProtectedRoute({ children, isAuthenticated }: ProtectedRouteProps) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function AppContent() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('authToken')
    if (token) {
      setIsAuthenticated(true)
    } else {
      setIsAuthenticated(false)
    }
    setCheckingAuth(false)
  }, [])

  const handleLoginSuccess = () => {
    setIsAuthenticated(true)
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  if (checkingAuth) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Typography>Loading...</Typography>
      </Box>
    )
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          backgroundColor: '#1976d2',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Job Application Analytics Dashboard
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          overflow: 'auto',
        }}
      >
            <Toolbar /> {/* Spacer for AppBar */}
            <Routes>
              <Route 
                path="/" 
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/job-links" 
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <JobLinks />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/job-search-analytics" 
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <JobSearchAnalytics />
                  </ProtectedRoute>
                } 
              />
              <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
      </Box>
    </Box>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
