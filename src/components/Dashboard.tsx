import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Paper,
  Card,
  CardContent,
  Typography,
  TextField,
  MenuItem,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Pagination,
  TableSortLabel,
  Select,
  FormControl,
  InputLabel,
  IconButton,
} from '@mui/material'
import {
  FilterList as FilterListIcon,
  SmartToy as SmartToyIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { analyticsAPI } from '../services/api'

interface AnalyticsOverview {
  overview: {
    totalApplications: number
    totalFields: number
    filledFields: number
    unfilledFields: number
    avgTotalFields: number
    avgFilledFields: number
    avgUnfilledFields: number
    avgCompletionRate: number
  }
  platformDistribution: Array<{ _id: string; count: number; avgFields: number; avgFilled: number }>
  timeSeries: Array<{ _id: string; count: number; avgCompletionRate: number }>
  fieldTypeAverages: Record<string, number>
}

interface Application {
  _id: string
  email: string
  platform: string
  url: string
  timestamp: string
  analysis: {
    totalFields: number
    filledFields: number
    unfilledFields: number
    notMatchedFields?: any[]
  }
  completionRate: number
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

// Helper function to get date range based on time period
const getDateRangeFromPeriod = (period: 'all' | 'today' | '3days' | '7days' | '30days'): { startDate: string; endDate: string } => {
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  const endDate = today.toISOString().split('T')[0]
  
  if (period === 'all') {
    return { startDate: '', endDate: '' }
  }
  
  const start = new Date()
  if (period === 'today') {
    start.setHours(0, 0, 0, 0)
  } else if (period === '3days') {
    start.setDate(start.getDate() - 3)
    start.setHours(0, 0, 0, 0)
  } else if (period === '7days') {
    start.setDate(start.getDate() - 7)
    start.setHours(0, 0, 0, 0)
  } else if (period === '30days') {
    start.setDate(start.getDate() - 30)
    start.setHours(0, 0, 0, 0)
  }
  
  const startDate = start.toISOString().split('T')[0]
  return { startDate, endDate }
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Time period selector
  const [timePeriod, setTimePeriod] = useState<'all' | 'today' | '3days' | '7days' | '30days'>('3days')
  
  // Data states
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedApplications, setSelectedApplications] = useState<string[]>([])
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  })
  const [sortBy, setSortBy] = useState('timestamp')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Filter states
  const [filters, setFilters] = useState({
    email: '',
    platform: '',
    startDate: '',
    endDate: '',
    minFields: '',
    maxFields: '',
    completionRate: '',
  })
  
  // Main tab state
  const [mainTab, setMainTab] = useState(0)
  
  // New Inputs Analytics state
  const [newInputsData, setNewInputsData] = useState<any>(null)
  const [newInputsLoading, setNewInputsLoading] = useState(false)
  const [newInputsApplications, setNewInputsApplications] = useState<any[]>([])
  const [newInputsPagination, setNewInputsPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  })
  const [newInputsSortBy, setNewInputsSortBy] = useState('timestamp')
  const [newInputsSortOrder, setNewInputsSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Detail view states
  const [detailDialog, setDetailDialog] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<any>(null)
  const [detailTab, setDetailTab] = useState(0)
  const [showJsonView, setShowJsonView] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  
  // AI Analysis states
  const [aiAnalysisDialog, setAiAnalysisDialog] = useState(false)
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [individualAILoading, setIndividualAILoading] = useState(false)

  // Fetch analytics overview
  const fetchOverview = async () => {
    try {
      setLoading(true)
      setError(null)
      const dateRange = getDateRangeFromPeriod(timePeriod)
      const params: any = {}
      if (filters.email) params.email = filters.email
      if (filters.platform) params.platform = filters.platform
      // Use time period date range if no manual dates are set
      if (filters.startDate) {
        params.startDate = filters.startDate
      } else if (dateRange.startDate) {
        params.startDate = dateRange.startDate
      }
      if (filters.endDate) {
        params.endDate = filters.endDate
      } else if (dateRange.endDate) {
        params.endDate = dateRange.endDate
      }

      const response = await analyticsAPI.getOverview(params)
      if (response.success) {
        setOverview(response.data)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch analytics overview')
      console.error('Error fetching overview:', err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch filtered applications
  const fetchApplications = async (resetOffset = false, customLimit?: number, customOffset?: number) => {
    try {
      setLoading(true)
      setError(null)
      const currentOffset = resetOffset ? 0 : (customOffset !== undefined ? customOffset : pagination.offset)
      const currentLimit = customLimit !== undefined ? customLimit : pagination.limit
      const dateRange = getDateRangeFromPeriod(timePeriod)
      const params: any = {
        limit: currentLimit,
        offset: currentOffset,
        sortBy,
        sortOrder,
      }
      
      // Apply time period date range if no manual dates are set
      if (filters.startDate) {
        params.startDate = filters.startDate
      } else if (dateRange.startDate) {
        params.startDate = dateRange.startDate
      }
      if (filters.endDate) {
        params.endDate = filters.endDate
      } else if (dateRange.endDate) {
        params.endDate = dateRange.endDate
      }
      
      // Apply other filters
      if (filters.email) params.email = filters.email
      if (filters.platform) params.platform = filters.platform
      if (filters.minFields) params.minFields = filters.minFields
      if (filters.maxFields) params.maxFields = filters.maxFields
      if (filters.completionRate) params.completionRate = filters.completionRate

      const response = await analyticsAPI.getFilteredApplications(params)
      if (response.success) {
        setApplications(response.data)
        if (response.pagination) {
          setPagination({
            total: response.pagination.total,
            limit: response.pagination.limit || currentLimit,
            offset: response.pagination.offset || currentOffset,
            hasMore: response.pagination.hasMore || false,
          })
        } else {
          setPagination((prev) => ({
            ...prev,
            limit: currentLimit,
            offset: currentOffset,
          }))
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch applications')
      console.error('Error fetching applications:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle filter changes
  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  // Apply filters
  const handleApplyFilters = () => {
    setPagination((prev) => ({ ...prev, offset: 0 }))
    if (mainTab === 0) {
      fetchOverview()
      fetchApplications(true)
    } else if (mainTab === 1) {
      fetchNewInputsAnalytics(true)
    }
  }

  // Handle pagination change
  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const newOffset = (page - 1) * pagination.limit
    setPagination((prev) => ({ ...prev, offset: newOffset }))
    fetchApplications(false, undefined, newOffset)
  }

  // Handle sort change
  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPagination((prev) => ({ ...prev, offset: 0 }))
    setTimeout(() => {
      fetchApplications(true)
    }, 0)
  }

  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      email: '',
      platform: '',
      startDate: '',
      endDate: '',
      minFields: '',
      maxFields: '',
      completionRate: '',
    })
    setPagination((prev) => ({ ...prev, offset: 0 }))
    setTimeout(() => {
      fetchOverview()
      fetchApplications(true)
    }, 100)
  }

  // Toggle application selection
  const handleSelectApplication = (id: string) => {
    setSelectedApplications((prev) =>
      prev.includes(id) ? prev.filter((appId) => appId !== id) : [...prev, id]
    )
  }

  // Select all applications
  const handleSelectAll = () => {
    if (selectedApplications.length === applications.length) {
      setSelectedApplications([])
    } else {
      setSelectedApplications(applications.map((app) => app._id))
    }
  }

  // View application details
  const handleViewDetails = async (application: Application) => {
    setSelectedApplication(application)
    setDetailDialog(true)
    setDetailTab(0)
    setShowJsonView(false)
    
    try {
      setDetailLoading(true)
      const response = await analyticsAPI.getApplicationById(application._id)
      if (response.success) {
        setSelectedApplication(response.data)
      }
    } catch (err: any) {
      console.error('Error fetching application details:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  // Get individual AI analysis
  const handleIndividualAIAnalysis = async () => {
    if (!selectedApplication) return

    try {
      setIndividualAILoading(true)
      setError(null)
      const response = await analyticsAPI.getIndividualAIAnalysis(selectedApplication._id)
      if (response.success) {
        if (response.data.application) {
          setSelectedApplication(response.data.application)
        }
        setAiAnalysis(response.data.aiInsights)
        setDetailTab(2)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to get AI analysis')
      console.error('Error getting individual AI analysis:', err)
    } finally {
      setIndividualAILoading(false)
    }
  }

  // Get AI analysis for selected applications
  const handleAIAnalysis = async () => {
    if (selectedApplications.length === 0) {
      setError('Please select at least one application for AI analysis')
      return
    }

    try {
      setAiAnalysisLoading(true)
      setAiAnalysisDialog(true)
      setError(null)

      const response = await analyticsAPI.getAIAnalysis(selectedApplications)
      if (response.success) {
        setAiAnalysis(response.data)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to get AI analysis')
      console.error('Error getting AI analysis:', err)
    } finally {
      setAiAnalysisLoading(false)
    }
  }

  // Initial data fetch
  // Handle time period change
  const handleTimePeriodChange = (period: 'all' | 'today' | '3days' | '7days' | '30days') => {
    setTimePeriod(period)
    setPagination((prev) => ({ ...prev, offset: 0 }))
    // Clear manual date filters when using time period
    setFilters((prev) => ({ ...prev, startDate: '', endDate: '' }))
  }

  // Fetch new inputs analytics
  const fetchNewInputsAnalytics = async (resetOffset = false, customLimit?: number, customOffset?: number) => {
    try {
      setNewInputsLoading(true)
      const dateRange = getDateRangeFromPeriod(timePeriod)
      const currentOffset = resetOffset ? 0 : (customOffset !== undefined ? customOffset : newInputsPagination.offset)
      const currentLimit = customLimit !== undefined ? customLimit : newInputsPagination.limit
      const params: any = {
        limit: currentLimit,
        offset: currentOffset,
        sortBy: newInputsSortBy,
        sortOrder: newInputsSortOrder,
      }
      
      if (filters.startDate) {
        params.startDate = filters.startDate
      } else if (dateRange.startDate) {
        params.startDate = dateRange.startDate
      }
      if (filters.endDate) {
        params.endDate = filters.endDate
      } else if (dateRange.endDate) {
        params.endDate = dateRange.endDate
      }
      
      if (filters.email) params.email = filters.email
      if (filters.platform) params.platform = filters.platform

      const response = await analyticsAPI.getNewInputsAnalytics(params)
      if (response.success) {
        setNewInputsData(response.data)
        if (response.data.applications) {
          setNewInputsApplications(response.data.applications)
        }
        if (response.data.pagination) {
          setNewInputsPagination({
            total: response.data.pagination.total,
            limit: response.data.pagination.limit || currentLimit,
            offset: response.data.pagination.offset || currentOffset,
            hasMore: response.data.pagination.hasMore || false,
          })
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch new inputs analytics')
      console.error('Error fetching new inputs analytics:', err)
    } finally {
      setNewInputsLoading(false)
    }
  }

  // Handle new inputs pagination
  const handleNewInputsPageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const newOffset = (page - 1) * newInputsPagination.limit
    setNewInputsPagination((prev) => ({ ...prev, offset: newOffset }))
    fetchNewInputsAnalytics(false, undefined, newOffset)
  }

  // Handle new inputs sort change
  const handleNewInputsSortChange = (field: string) => {
    if (newInputsSortBy === field) {
      setNewInputsSortOrder(newInputsSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setNewInputsSortBy(field)
      setNewInputsSortOrder('desc')
    }
    setNewInputsPagination((prev) => ({ ...prev, offset: 0 }))
    setTimeout(() => {
      fetchNewInputsAnalytics(true)
    }, 0)
  }

  useEffect(() => {
    if (mainTab === 0) {
      fetchOverview()
      fetchApplications(true)
    } else if (mainTab === 1) {
      fetchNewInputsAnalytics(true)
    }
  }, [pagination.limit, timePeriod, mainTab, newInputsPagination.limit, newInputsSortBy, newInputsSortOrder])

  // Prepare chart data
  const platformData = overview?.platformDistribution || []
  const timeSeriesData = overview?.timeSeries.map((item) => ({
    date: item._id,
    applications: item.count,
    completionRate: item.avgCompletionRate,
  })) || []

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', backgroundColor: '#f5f5f5', width: '100%' }}>
      <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
        {/* Header with Time Period Selector */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
            Application Analytics Dashboard
          </Typography>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Time Period</InputLabel>
            <Select
              value={timePeriod}
              label="Time Period"
              onChange={(e) => handleTimePeriodChange(e.target.value as 'all' | 'today' | '3days' | '7days' | '30days')}
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="3days">Last 3 Days</MenuItem>
              <MenuItem value="7days">Last 7 Days</MenuItem>
              <MenuItem value="30days">Last 30 Days</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Main Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={mainTab} onChange={(_, newValue) => setMainTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="New Inputs Analytics" />
          </Tabs>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Tab Content */}
        {mainTab === 0 && (
          <>
            {/* Filters Section */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <FilterListIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Filters</Typography>
              </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(25% - 12px)' } }}>
              <TextField
                fullWidth
                label="Email"
                value={filters.email}
                onChange={(e) => handleFilterChange('email', e.target.value)}
                size="small"
              />
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(25% - 12px)' } }}>
              <FormControl fullWidth size="small">
                <InputLabel>Platform</InputLabel>
                <Select
                  value={filters.platform}
                  label="Platform"
                  onChange={(e: any) => handleFilterChange('platform', e.target.value)}
                >
                  <MenuItem value="">All Platforms</MenuItem>
                  <MenuItem value="lever">Lever</MenuItem>
                  <MenuItem value="rippling">Rippling</MenuItem>
                  <MenuItem value="ashby">Ashby</MenuItem>
                  <MenuItem value="greenhouse">Greenhouse</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(25% - 12px)' } }}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(25% - 12px)' } }}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(16.66% - 10px)' } }}>
              <TextField
                fullWidth
                label="Min Fields"
                type="number"
                value={filters.minFields}
                onChange={(e) => handleFilterChange('minFields', e.target.value)}
                size="small"
              />
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(16.66% - 10px)' } }}>
              <TextField
                fullWidth
                label="Max Fields"
                type="number"
                value={filters.maxFields}
                onChange={(e) => handleFilterChange('maxFields', e.target.value)}
                size="small"
              />
            </Box>
            <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(16.66% - 10px)' } }}>
              <TextField
                fullWidth
                label="Min Completion %"
                type="number"
                value={filters.completionRate}
                onChange={(e) => handleFilterChange('completionRate', e.target.value)}
                size="small"
                inputProps={{ min: 0, max: 100 }}
              />
            </Box>
            <Box sx={{ width: { xs: '100%', sm: '100%', md: 'calc(50% - 8px)' }, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Button
                variant="contained"
                onClick={handleApplyFilters}
                startIcon={<FilterListIcon />}
              >
                Apply Filters
              </Button>
              <Button variant="outlined" onClick={handleResetFilters}>
                Reset
              </Button>
              {selectedApplications.length > 0 && (
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleAIAnalysis}
                  startIcon={<SmartToyIcon />}
                >
                  AI Analysis ({selectedApplications.length})
                </Button>
              )}
            </Box>
          </Box>
        </Paper>

        {loading && !overview ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : overview && (
          <>
            {/* Overview Cards */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <Card sx={{ flex: '1 1 200px' }}>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Applications
                  </Typography>
                  <Typography variant="h4">{overview.overview.totalApplications}</Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: '1 1 200px' }}>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Fields
                  </Typography>
                  <Typography variant="h4">{overview.overview.totalFields.toLocaleString()}</Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: '1 1 200px' }}>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Filled Fields
                  </Typography>
                  <Typography variant="h4">{overview.overview.filledFields.toLocaleString()}</Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: '1 1 200px' }}>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Unfilled Fields
                  </Typography>
                  <Typography variant="h4">{overview.overview.unfilledFields.toLocaleString()}</Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: '1 1 200px' }}>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Avg Completion Rate
                  </Typography>
                  <Typography variant="h4">
                    {overview.overview.avgCompletionRate.toFixed(1)}%
                  </Typography>
                </CardContent>
              </Card>
            </Box>

            {/* Charts */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <Paper sx={{ p: 3, flex: '1 1 400px' }}>
                <Typography variant="h6" gutterBottom>
                  Applications Over Time
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="applications" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
              <Paper sx={{ p: 3, flex: '1 1 400px' }}>
                <Typography variant="h6" gutterBottom>
                  Platform Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={platformData}
                      dataKey="count"
                      nameKey="_id"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {platformData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Box>

            {/* Applications Table */}
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Applications ({pagination.total > 0 ? pagination.total : applications.length})
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Items per page</InputLabel>
                    <Select
                      value={pagination.limit}
                      label="Items per page"
                      onChange={(e: any) => {
                        const newLimit = Number(e.target.value)
                        setPagination((prev) => ({ ...prev, limit: newLimit, offset: 0 }))
                        fetchApplications(true, newLimit)
                      }}
                    >
                      <MenuItem value={25}>25</MenuItem>
                      <MenuItem value={50}>50</MenuItem>
                      <MenuItem value={100}>100</MenuItem>
                      <MenuItem value={200}>200</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selectedApplications.length > 0 && selectedApplications.length < applications.length}
                          checked={applications.length > 0 && selectedApplications.length === applications.length}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'email'}
                          direction={sortBy === 'email' ? sortOrder : 'asc'}
                          onClick={() => handleSortChange('email')}
                        >
                          Email
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'platform'}
                          direction={sortBy === 'platform' ? sortOrder : 'asc'}
                          onClick={() => handleSortChange('platform')}
                        >
                          Platform
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'analysis.totalFields'}
                          direction={sortBy === 'analysis.totalFields' ? sortOrder : 'asc'}
                          onClick={() => handleSortChange('analysis.totalFields')}
                        >
                          Total Fields
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'analysis.filledFields'}
                          direction={sortBy === 'analysis.filledFields' ? sortOrder : 'asc'}
                          onClick={() => handleSortChange('analysis.filledFields')}
                        >
                          Filled Fields
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'analysis.unfilledFields'}
                          direction={sortBy === 'analysis.unfilledFields' ? sortOrder : 'asc'}
                          onClick={() => handleSortChange('analysis.unfilledFields')}
                        >
                          Unfilled Fields
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'analysis.notMatchedFieldsCount'}
                          direction={sortBy === 'analysis.notMatchedFieldsCount' ? sortOrder : 'asc'}
                          onClick={() => handleSortChange('analysis.notMatchedFieldsCount')}
                        >
                          Unmatched Fields
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={sortBy === 'timestamp'}
                          direction={sortBy === 'timestamp' ? sortOrder : 'asc'}
                          onClick={() => handleSortChange('timestamp')}
                        >
                          Date
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>Completion Rate</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {applications.map((app) => (
                      <TableRow
                        key={app._id}
                        hover
                        selected={selectedApplications.includes(app._id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedApplications.includes(app._id)}
                            onChange={() => handleSelectApplication(app._id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell onClick={() => handleViewDetails(app)}>{app.email}</TableCell>
                        <TableCell onClick={() => handleViewDetails(app)}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Chip label={app.platform} size="small" color="primary" variant="outlined" />
                            {app.url && (app.platform?.toLowerCase() === 'greenhouse' || 
                              app.platform?.toLowerCase() === 'ashby' || 
                              app.platform?.toLowerCase() === 'lever' || 
                              app.platform?.toLowerCase() === 'rippling' ||
                              app.url?.toLowerCase().includes('greenhouse') ||
                              app.url?.toLowerCase().includes('ashby') ||
                              app.url?.toLowerCase().includes('lever') ||
                              app.url?.toLowerCase().includes('rippling')) && (
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: 'text.secondary', 
                                  maxWidth: 200, 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap',
                                  fontSize: '0.7rem'
                                }} 
                                title={app.url}
                              >
                                {app.url}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell onClick={() => handleViewDetails(app)}>{app.analysis?.totalFields || 0}</TableCell>
                        <TableCell onClick={() => handleViewDetails(app)}>{app.analysis?.filledFields || 0}</TableCell>
                        <TableCell onClick={() => handleViewDetails(app)}>{app.analysis?.unfilledFields || 0}</TableCell>
                        <TableCell onClick={() => handleViewDetails(app)}>
                          {app.analysis?.notMatchedFields?.length || 0}
                        </TableCell>
                        <TableCell onClick={() => handleViewDetails(app)}>
                          {new Date(app.timestamp).toLocaleDateString()}
                        </TableCell>
                        <TableCell onClick={() => handleViewDetails(app)}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: '100%', mr: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={app.completionRate}
                                sx={{ height: 8, borderRadius: 4 }}
                              />
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {app.completionRate.toFixed(1)}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            size="small"
                            onClick={() => handleViewDetails(app)}
                            color="primary"
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {pagination.total > pagination.limit && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={Math.ceil(pagination.total / pagination.limit)}
                    page={Math.floor(pagination.offset / pagination.limit) + 1}
                    onChange={handlePageChange}
                    color="primary"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </Paper>
          </>
        )}
          </>
        )}

        {mainTab === 1 && (
          <>
            {/* New Inputs Analytics Content */}
            {newInputsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : newInputsData ? (
              <>
                {/* Overview Cards */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                  <Card sx={{ flex: '1 1 200px' }}>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Applications with New Inputs
                      </Typography>
                      <Typography variant="h4">{newInputsData.overview.totalApplicationsWithNewInputs}</Typography>
                    </CardContent>
                  </Card>
                  <Card sx={{ flex: '1 1 200px' }}>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Total New Inputs
                      </Typography>
                      <Typography variant="h4">{newInputsData.overview.totalNewInputs.toLocaleString()}</Typography>
                    </CardContent>
                  </Card>
                  <Card sx={{ flex: '1 1 200px' }}>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Valid Inputs
                      </Typography>
                      <Typography variant="h4">{newInputsData.overview.totalValidInputs.toLocaleString()}</Typography>
                    </CardContent>
                  </Card>
                  <Card sx={{ flex: '1 1 200px' }}>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Invalid Inputs
                      </Typography>
                      <Typography variant="h4">{newInputsData.overview.totalInvalidInputs.toLocaleString()}</Typography>
                    </CardContent>
                  </Card>
                  <Card sx={{ flex: '1 1 200px' }}>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Avg per Application
                      </Typography>
                      <Typography variant="h4">
                        {newInputsData.overview.avgNewInputsPerApplication.toFixed(2)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>

                {/* Charts */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                  <Paper sx={{ p: 3, flex: '1 1 400px' }}>
                    <Typography variant="h6" gutterBottom>
                      New Inputs by Type
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Radio', value: newInputsData.byType.radio },
                            { name: 'Checkbox', value: newInputsData.byType.checkbox },
                            { name: 'Text', value: newInputsData.byType.text },
                            { name: 'Select', value: newInputsData.byType.select },
                            { name: 'Textarea', value: newInputsData.byType.textarea },
                          ].filter(item => item.value > 0)}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {[
                            { name: 'Radio', value: newInputsData.byType.radio },
                            { name: 'Checkbox', value: newInputsData.byType.checkbox },
                            { name: 'Text', value: newInputsData.byType.text },
                            { name: 'Select', value: newInputsData.byType.select },
                            { name: 'Textarea', value: newInputsData.byType.textarea },
                          ].filter(item => item.value > 0).map((_entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Paper>
                  <Paper sx={{ p: 3, flex: '1 1 400px' }}>
                    <Typography variant="h6" gutterBottom>
                      New Inputs Over Time
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={newInputsData.timeSeries.map((item: any) => ({
                        date: item._id,
                        count: item.count,
                        totalNewInputs: item.totalNewInputs,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="count" stroke="#8884d8" name="Applications" />
                        <Line type="monotone" dataKey="totalNewInputs" stroke="#82ca9d" name="New Inputs" />
                      </LineChart>
                    </ResponsiveContainer>
                  </Paper>
                </Box>

                {/* Platform Distribution */}
                {newInputsData.platformDistribution && newInputsData.platformDistribution.length > 0 && (
                  <Paper sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Platform Distribution
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Platform</TableCell>
                            <TableCell>Applications</TableCell>
                            <TableCell>Total New Inputs</TableCell>
                            <TableCell>Avg New Inputs</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {newInputsData.platformDistribution.map((platform: any) => (
                            <TableRow key={platform._id}>
                              <TableCell>{platform._id || 'Unknown'}</TableCell>
                              <TableCell>{platform.count}</TableCell>
                              <TableCell>{platform.totalNewInputs}</TableCell>
                              <TableCell>{platform.avgNewInputs.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                )}

                {/* Top Questions */}
                {newInputsData.topQuestions && newInputsData.topQuestions.length > 0 && (
                  <Paper sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Top Questions/Values
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Question/Value</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {newInputsData.topQuestions.map((item: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell sx={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item._id || 'N/A'}
                              </TableCell>
                              <TableCell>{item.type || 'N/A'}</TableCell>
                              <TableCell>{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                )}

                {/* Properties Breakdown */}
                <Paper sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Input Properties Breakdown
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <Card sx={{ flex: '1 1 200px' }}>
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>With Options</Typography>
                        <Typography variant="h5">{newInputsData.properties.withOptions}</Typography>
                      </CardContent>
                    </Card>
                    <Card sx={{ flex: '1 1 200px' }}>
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>Without Options</Typography>
                        <Typography variant="h5">{newInputsData.properties.withoutOptions}</Typography>
                      </CardContent>
                    </Card>
                    <Card sx={{ flex: '1 1 200px' }}>
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>With Value</Typography>
                        <Typography variant="h5">{newInputsData.properties.withValue}</Typography>
                      </CardContent>
                    </Card>
                    <Card sx={{ flex: '1 1 200px' }}>
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>With Name</Typography>
                        <Typography variant="h5">{newInputsData.properties.withName}</Typography>
                      </CardContent>
                    </Card>
                    <Card sx={{ flex: '1 1 200px' }}>
                      <CardContent>
                        <Typography color="text.secondary" gutterBottom>With ID</Typography>
                        <Typography variant="h5">{newInputsData.properties.withId}</Typography>
                      </CardContent>
                    </Card>
                  </Box>
                </Paper>

                {/* Applications Table */}
                <Paper sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Applications with New Inputs ({newInputsPagination.total > 0 ? newInputsPagination.total : newInputsApplications.length})
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Items per page</InputLabel>
                        <Select
                          value={newInputsPagination.limit}
                          label="Items per page"
                          onChange={(e: any) => {
                            const newLimit = Number(e.target.value)
                            setNewInputsPagination((prev) => ({ ...prev, limit: newLimit, offset: 0 }))
                            fetchNewInputsAnalytics(true, newLimit)
                          }}
                        >
                          <MenuItem value={25}>25</MenuItem>
                          <MenuItem value={50}>50</MenuItem>
                          <MenuItem value={100}>100</MenuItem>
                          <MenuItem value={200}>200</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Box>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            <TableSortLabel
                              active={newInputsSortBy === 'email'}
                              direction={newInputsSortBy === 'email' ? newInputsSortOrder : 'asc'}
                              onClick={() => handleNewInputsSortChange('email')}
                            >
                              Email
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>
                            <TableSortLabel
                              active={newInputsSortBy === 'platform'}
                              direction={newInputsSortBy === 'platform' ? newInputsSortOrder : 'asc'}
                              onClick={() => handleNewInputsSortChange('platform')}
                            >
                              Platform
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>
                            <TableSortLabel
                              active={newInputsSortBy === 'newInputsCount'}
                              direction={newInputsSortBy === 'newInputsCount' ? newInputsSortOrder : 'asc'}
                              onClick={() => handleNewInputsSortChange('newInputsCount')}
                            >
                              New Inputs Count
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>
                            <TableSortLabel
                              active={newInputsSortBy === 'timestamp'}
                              direction={newInputsSortBy === 'timestamp' ? newInputsSortOrder : 'asc'}
                              onClick={() => handleNewInputsSortChange('timestamp')}
                            >
                              Date
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {newInputsApplications.map((app) => (
                          <TableRow
                            key={app._id}
                            hover
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell onClick={() => handleViewDetails(app)}>{app.email}</TableCell>
                            <TableCell onClick={() => handleViewDetails(app)}>
                              <Chip label={app.platform} size="small" color="primary" variant="outlined" />
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(app)}>
                              {app.newInputsCount || (app.newInputs ? app.newInputs.length : 0)}
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(app)}>
                              {new Date(app.timestamp).toLocaleDateString()}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <IconButton
                                size="small"
                                onClick={() => handleViewDetails(app)}
                                color="primary"
                              >
                                <VisibilityIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {newInputsPagination.total > newInputsPagination.limit && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                      <Pagination
                        count={Math.ceil(newInputsPagination.total / newInputsPagination.limit)}
                        page={Math.floor(newInputsPagination.offset / newInputsPagination.limit) + 1}
                        onChange={handleNewInputsPageChange}
                        color="primary"
                        showFirstButton
                        showLastButton
                      />
                    </Box>
                  )}
                </Paper>
              </>
            ) : (
              <Alert severity="info">No new inputs data available for the selected filters.</Alert>
            )}
          </>
        )}
      </Container>

      {/* Detail View Dialog */}
      <Dialog
        open={detailDialog}
        onClose={() => setDetailDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Application Details</Typography>
            <IconButton onClick={() => setDetailDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {detailLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {selectedApplication && !detailLoading && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Tabs value={detailTab} onChange={(_, newValue) => setDetailTab(newValue)}>
                  <Tab label="Overview" />
                  <Tab label="Fields" />
                  <Tab label="New Inputs" />
                  <Tab label="AI Analysis" />
                  <Tab label="View Form" />
                  <Tab label="Raw JSON" />
                </Tabs>
              </Box>
              <Divider sx={{ mb: 2 }} />
              
              {detailTab === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Application Information</Typography>
                  <List>
                    <ListItem>
                      <ListItemText primary="Email" secondary={selectedApplication.email} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Platform" secondary={selectedApplication.platform} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="URL" secondary={<a href={selectedApplication.url} target="_blank" rel="noopener noreferrer">{selectedApplication.url}</a>} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Date" secondary={new Date(selectedApplication.timestamp).toLocaleString()} />
                    </ListItem>
                    {selectedApplication.analysis && (
                      <>
                        <ListItem>
                          <ListItemText primary="Total Fields" secondary={selectedApplication.analysis.totalFields || 0} />
                        </ListItem>
                        <ListItem>
                          <ListItemText primary="Filled Fields" secondary={selectedApplication.analysis.filledFields || 0} />
                        </ListItem>
                        <ListItem>
                          <ListItemText primary="Unfilled Fields" secondary={selectedApplication.analysis.unfilledFields || 0} />
                        </ListItem>
                        <ListItem>
                          <ListItemText primary="Completion Rate" secondary={`${selectedApplication.completionRate?.toFixed(1) || 0}%`} />
                        </ListItem>
                      </>
                    )}
                  </List>
                  <Button
                    variant="contained"
                    startIcon={<SmartToyIcon />}
                    onClick={handleIndividualAIAnalysis}
                    disabled={individualAILoading}
                    sx={{ mt: 2 }}
                  >
                    {individualAILoading ? 'Analyzing...' : 'Get AI Analysis'}
                  </Button>
                </Box>
              )}

              {detailTab === 1 && selectedApplication.analysis?.fields && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Field Details</Typography>
                    <ToggleButtonGroup
                      value={showJsonView ? 'json' : 'table'}
                      exclusive
                      onChange={(_, newValue) => setShowJsonView(newValue === 'json')}
                      size="small"
                    >
                      <ToggleButton value="table">Table View</ToggleButton>
                      <ToggleButton value="json">JSON View</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                  {showJsonView ? (
                    <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', maxHeight: 600, overflow: 'auto' }}>
                      <Typography
                        component="pre"
                        sx={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          fontSize: '0.875rem',
                          fontFamily: 'monospace',
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(selectedApplication, null, 2)}
                      </Typography>
                    </Paper>
                  ) : (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Type</TableCell>
                            <TableCell>Question</TableCell>
                            <TableCell>Filled</TableCell>
                            <TableCell>Matched</TableCell>
                            <TableCell>Answer</TableCell>
                            <TableCell>Current Value</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedApplication.analysis.fields.slice(0, 50).map((field: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>{field.type}</TableCell>
                              <TableCell sx={{ maxWidth: 200 }}>{typeof field.question === 'string' ? field.question : field.question?.text || 'N/A'}</TableCell>
                              <TableCell>{field.isFilled ? '✓' : '✗'}</TableCell>
                              <TableCell>{field.valueMatches ? '✓' : '✗'}</TableCell>
                              <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {field.answer || 'N/A'}
                              </TableCell>
                              <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {field.currentValue ? (Array.isArray(field.currentValue) ? field.currentValue.join(', ') : String(field.currentValue)) : 'N/A'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              )}

              {detailTab === 2 && selectedApplication.newInputs && (
                <Box>
                  <Typography variant="h6" gutterBottom>New Inputs</Typography>
                  {selectedApplication.newInputsAnalytics && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="subtitle1" gutterBottom>Analytics Summary</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                        <Chip label={`Total: ${selectedApplication.newInputsAnalytics.total || selectedApplication.newInputs.length}`} color="primary" />
                        <Chip label={`Valid: ${selectedApplication.newInputsAnalytics.validInputs || 0}`} color="success" />
                        <Chip label={`Invalid: ${selectedApplication.newInputsAnalytics.invalidInputs || 0}`} color="error" />
                      </Box>
                      {selectedApplication.newInputsAnalytics.byType && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>By Type:</Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {Object.entries(selectedApplication.newInputsAnalytics.byType).map(([type, count]: [string, any]) => (
                              count > 0 && <Chip key={type} label={`${type}: ${count}`} size="small" />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell>Question</TableCell>
                          <TableCell>Value</TableCell>
                          <TableCell>Element</TableCell>
                          <TableCell>Name</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedApplication.newInputs.map((input: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Chip label={input.type || 'N/A'} size="small" />
                            </TableCell>
                            <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {input.question || 'N/A'}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {input.value || 'N/A'}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {input.element || 'N/A'}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {input.name || 'N/A'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {detailTab === 3 && (
                <Box>
                  <Typography variant="h6" gutterBottom>AI Analysis</Typography>
                  {individualAILoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : aiAnalysis ? (
                    <Box>
                      {aiAnalysis.unfilledAnalysis && (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Unfilled Fields Analysis
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {typeof aiAnalysis.unfilledAnalysis === 'string' ? aiAnalysis.unfilledAnalysis : JSON.stringify(aiAnalysis.unfilledAnalysis, null, 2)}
                          </Typography>
                        </Box>
                      )}
                      {aiAnalysis.unmatchedAnalysis && (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Unmatched Fields Analysis
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {typeof aiAnalysis.unmatchedAnalysis === 'string' ? aiAnalysis.unmatchedAnalysis : JSON.stringify(aiAnalysis.unmatchedAnalysis, null, 2)}
                          </Typography>
                        </Box>
                      )}
                      {aiAnalysis.recommendations && (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Recommendations
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {typeof aiAnalysis.recommendations === 'string' ? aiAnalysis.recommendations : JSON.stringify(aiAnalysis.recommendations, null, 2)}
                          </Typography>
                        </Box>
                      )}
                      {aiAnalysis.patterns && (
                        <Box sx={{ mb: 3 }}>
                          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Patterns
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {typeof aiAnalysis.patterns === 'string' ? aiAnalysis.patterns : JSON.stringify(aiAnalysis.patterns, null, 2)}
                          </Typography>
                        </Box>
                      )}
                      {aiAnalysis.suggestions && (
                        <Box>
                          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Suggestions
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {typeof aiAnalysis.suggestions === 'string' ? aiAnalysis.suggestions : JSON.stringify(aiAnalysis.suggestions, null, 2)}
                          </Typography>
                        </Box>
                      )}
                      {aiAnalysis.analysis && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {aiAnalysis.analysis}
                          </Typography>
                        </Box>
                      )}
                      {aiAnalysis.message && !aiAnalysis.error && (
                        <Alert severity="info">{aiAnalysis.message}</Alert>
                      )}
                    </Box>
                  ) : (
                    <Alert severity="info">
                      Click "Get AI Analysis" button to analyze unfilled and unmatched fields
                    </Alert>
                  )}
                </Box>
              )}

              {detailTab === 4 && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Job Application Form</Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      href={selectedApplication.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ ml: 2 }}
                    >
                      Open in New Tab
                    </Button>
                  </Box>
                  <Paper sx={{ p: 1, backgroundColor: '#f5f5f5' }}>
                    <Box
                      sx={{
                        width: '100%',
                        height: '600px',
                        border: '1px solid #ddd',
                        borderRadius: 1,
                        overflow: 'hidden',
                        backgroundColor: '#fff',
                      }}
                    >
                      <iframe
                        src={selectedApplication.url}
                        title="Job Application Form"
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                        }}
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
                        loading="lazy"
                      />
                    </Box>
                  </Paper>
                </Box>
              )}

              {detailTab === 5 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Raw JSON Data</Typography>
                  <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', maxHeight: 600, overflow: 'auto' }}>
                    <Typography
                      component="pre"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(selectedApplication, null, 2)}
                    </Typography>
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Bulk AI Analysis Dialog */}
      <Dialog
        open={aiAnalysisDialog}
        onClose={() => setAiAnalysisDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">AI Analysis</Typography>
            <IconButton onClick={() => setAiAnalysisDialog(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {aiAnalysisLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : aiAnalysis ? (
            <Box>
              {aiAnalysis.summary && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    Summary
                  </Typography>
                  <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f5f5f5' }}>
                    <Typography><strong>Total Applications:</strong> {aiAnalysis.summary.totalApplications || 0}</Typography>
                    <Typography><strong>Average Completion Rate:</strong> {(aiAnalysis.summary.avgCompletionRate || 0).toFixed(2)}%</Typography>
                    <Typography><strong>Average Fields per Application:</strong> {(aiAnalysis.summary.avgFieldsPerApplication || 0).toFixed(2)}</Typography>
                  </Paper>
                </>
              )}
              
              {aiAnalysis.aiInsights && (
                <>
                  {aiAnalysis.aiInsights.patterns && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" gutterBottom>Patterns</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {typeof aiAnalysis.aiInsights.patterns === 'string' ? aiAnalysis.aiInsights.patterns : JSON.stringify(aiAnalysis.aiInsights.patterns, null, 2)}
                      </Typography>
                    </Box>
                  )}
                  {aiAnalysis.aiInsights.recommendations && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" gutterBottom>Recommendations</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {typeof aiAnalysis.aiInsights.recommendations === 'string' ? aiAnalysis.aiInsights.recommendations : JSON.stringify(aiAnalysis.aiInsights.recommendations, null, 2)}
                      </Typography>
                    </Box>
                  )}
                  {aiAnalysis.aiInsights.insights && (
                    <Box>
                      <Typography variant="h6" gutterBottom>Insights</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {typeof aiAnalysis.aiInsights.insights === 'string' ? aiAnalysis.aiInsights.insights : JSON.stringify(aiAnalysis.aiInsights.insights, null, 2)}
                      </Typography>
                    </Box>
                  )}
                </>
              )}
              
              {aiAnalysis.unfilledAnalysis && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Unfilled Fields Analysis
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {typeof aiAnalysis.unfilledAnalysis === 'string' ? aiAnalysis.unfilledAnalysis : JSON.stringify(aiAnalysis.unfilledAnalysis, null, 2)}
                  </Typography>
                </Box>
              )}
              {aiAnalysis.unmatchedAnalysis && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Unmatched Fields Analysis
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {typeof aiAnalysis.unmatchedAnalysis === 'string' ? aiAnalysis.unmatchedAnalysis : JSON.stringify(aiAnalysis.unmatchedAnalysis, null, 2)}
                  </Typography>
                </Box>
              )}
              
              {aiAnalysis.message && !aiAnalysis.error && (
                <Alert severity="info" sx={{ mt: 2 }}>{aiAnalysis.message}</Alert>
              )}
              {aiAnalysis.error && (
                <Alert severity="error" sx={{ mt: 2 }}>{aiAnalysis.error}</Alert>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiAnalysisDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
