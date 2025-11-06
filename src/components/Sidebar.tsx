import { useNavigate, useLocation } from 'react-router-dom'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Box,
  Divider,
  Typography,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Link as LinkIcon,
  Search as SearchIcon,
} from '@mui/icons-material'

const DRAWER_WIDTH = 240

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Job Links', icon: <LinkIcon />, path: '/job-links' },
    { text: 'Job Search Analytics', icon: <SearchIcon />, path: '/job-search-analytics' },
  ]

  const handleNavigation = (path: string) => {
    navigate(path)
    onMobileClose()
  }

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          Analytics Dashboard
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  )

  return (
    <Box
      component="nav"
      sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
    >
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
      >
        {drawer}
      </Drawer>
      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: DRAWER_WIDTH,
            position: 'relative',
            height: '100%',
          },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
  )
}

