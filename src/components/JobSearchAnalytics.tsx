import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tabs,
  Tab,
  Divider,
  List,
  ListItem,
  ListItemText,
  Pagination,
  TableSortLabel,
} from '@mui/material'
import {
  FilterList as FilterListIcon,
  TrendingUp as TrendingUpIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  BarChart as BarChartIcon,
  Speed as SpeedIcon,
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
import { jobSearchAnalyticsAPI, promptAPI } from '../services/api'

interface JobSearchOverview {
  overview: {
    totalSearches: number
    totalJobsFound: number
    totalJobsReturned: number
    avgJobsFound: number
    avgJobsReturned: number
    avgResponseTime: number
    avgValidationTime: number
    totalApiCalls: number
    totalScrapingDogCalls: number
  }
  platformDistribution: Array<{ _id: string; count: number }>
  timeSeries: Array<{ _id: string; count: number; avgJobsFound: number; avgJobsReturned: number }>
  topTitles: Array<{ _id: string; count: number }>
}

interface JobSearch {
  _id: string
  email: string
  searchSessionId: string
  searchParams: {
    originalTitles: string[]
    originalLocations: string[]
    country: string
    results: number
    timeFilter: string
  }
  validatedParams: {
    validatedTitles: string[]
    validatedLocations: string[]
  }
  query?: {
    finalQuery?: string
    queryDetails?: any
    [key: string]: any
  }
  results: {
    requested: number
    needed: number
    found: number
    returned: number
    filteredOut: {
      appliedJobs: number
      excludedCompanies: number
      greenhouseExcluded: number
      total: number
    }
    appliedJobsCount: number
    paginationUsed: boolean
    pagesFetched: number
    totalPages: number
  }
  performance: {
    responseTime: number
    validationTime: number
    apiCalls: {
      total: number
      scrapingDog: number
      openai: number
    }
  }
  platformBreakdown: {
    greenhouse: number
    lever: number
    ashbyhq: number
    rippling: number
    other: number
  }
  status: string
  interrupted?: boolean
  interruptedReason?: string
  createdAt: string
  updatedAt: string
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

// Helper function to get human-readable label for interrupted reason
const getInterruptedReasonLabel = (reason: string | undefined): string => {
  if (!reason) return 'N/A'
  
  const reasonMap: Record<string, string> = {
    'page_unload': 'Page Refresh/Close',
    'new_search_started': 'New Search Initiated',
    'search_error': 'Search Encountered an Error',
    'component_unmount': 'Component Unmounted',
  }
  
  return reasonMap[reason] || reason
}

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

// Helper function to convert time filter code to human-readable text
const getTimeFilterLabel = (timeFilter: string | undefined): string => {
  if (!timeFilter) return 'N/A'
  
  const timeFilterMap: Record<string, string> = {
    'qdr:d': 'past 24 hours',
    'qdr:w': 'past week',
    'qdr:m': 'past month',
    'qdr:y': 'past year',
    'qdr:a': 'all time',
    'd': 'past 24 hours',
    'w': 'past week',
    'm': 'past month',
    'y': 'past year',
    'a': 'all time',
  }
  
  return timeFilterMap[timeFilter.toLowerCase()] || timeFilter
}

export default function JobSearchAnalytics() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Time period selector
  const [timePeriod, setTimePeriod] = useState<'all' | 'today' | '3days' | '7days' | '30days'>('3days')
  
  // Data states
  const [overview, setOverview] = useState<JobSearchOverview | null>(null)
  const [searches, setSearches] = useState<JobSearch[]>([])
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  })
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Filter states
  const [filters, setFilters] = useState({
    email: '',
    startDate: '',
    endDate: '',
    minJobsFound: '',
    maxJobsFound: '',
    interrupted: '',
    interruptedReason: '',
  })
  
  // Detail view states
  const [detailDialog, setDetailDialog] = useState(false)
  const [selectedSearch, setSelectedSearch] = useState<JobSearch | null>(null)
  const [detailTab, setDetailTab] = useState(0)
  const [detailLoading, setDetailLoading] = useState(false)
  
  // Prompt management states
  const [prompts, setPrompts] = useState<{
    validateJobTitle?: { promptContent: string; isDefault: boolean; version: number; promptId: string | null }
    validateLocation?: { promptContent: string; isDefault: boolean; version: number; promptId: string | null }
  } | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<'validateJobTitle' | 'validateLocation' | null>(null)
  const [editedPromptContent, setEditedPromptContent] = useState('')
  const [promptDescription, setPromptDescription] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [loadingPrompts, setLoadingPrompts] = useState(false)
  
  // Test prompt states
  const [testTitles, setTestTitles] = useState<string>('')
  const [testLocations, setTestLocations] = useState<string>('')
  const [testResults, setTestResults] = useState<any>(null)
  const [testingPrompts, setTestingPrompts] = useState(false)
  
  // Test job search states
  const [testJobSearchResults, setTestJobSearchResults] = useState<any>(null)
  const [testingJobSearch, setTestingJobSearch] = useState(false)

  // Low return rate states
  const [mainTab, setMainTab] = useState(0) // 0 = All Searches, 1 = Low Return Rate
  const [lowReturnRatePercentage, setLowReturnRatePercentage] = useState(50)
  const [lowReturnRateSearches, setLowReturnRateSearches] = useState<JobSearch[]>([])
  const [lowReturnRatePagination, setLowReturnRatePagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  })
  const [lowReturnRateAnalytics, setLowReturnRateAnalytics] = useState<any>(null)
  const [lowReturnRateLoading, setLowReturnRateLoading] = useState(false)


  // Fetch filtered searches
  const fetchSearches = async (resetOffset = false, customLimit?: number, customOffset?: number, customSortBy?: string, customSortOrder?: 'asc' | 'desc') => {
    try {
      setLoading(true)
      setError(null)
      const currentOffset = resetOffset ? 0 : (customOffset !== undefined ? customOffset : pagination.offset)
      const currentLimit = customLimit !== undefined ? customLimit : pagination.limit
      const sortByToUse = customSortBy !== undefined ? customSortBy : sortBy
      const sortOrderToUse = customSortOrder !== undefined ? customSortOrder : sortOrder
      const dateRange = getDateRangeFromPeriod(timePeriod)
      const params: any = {
        limit: currentLimit,
        offset: currentOffset,
        sortBy: sortByToUse,
        sortOrder: sortOrderToUse,
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
      if (filters.minJobsFound) params.minJobsFound = filters.minJobsFound
      if (filters.maxJobsFound) params.maxJobsFound = filters.maxJobsFound
      if (filters.interrupted !== '') params.interrupted = filters.interrupted

      const response = await jobSearchAnalyticsAPI.getFilteredSearches(params)
      if (response.success) {
        setSearches(response.data)
        if (response.pagination) {
          setPagination({
            total: response.pagination.total,
            limit: response.pagination.limit || currentLimit,
            offset: response.pagination.offset || currentOffset,
            hasMore: response.pagination.hasMore || false,
          })
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch searches')
      console.error('Error fetching searches:', err)
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
    fetchOverviewWithFilters()
    fetchSearchesWithFilters(true)
  }

  // Handle pagination change
  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const newOffset = (page - 1) * pagination.limit
    setPagination((prev) => ({ ...prev, offset: newOffset }))
    fetchSearches(false, undefined, newOffset)
  }

  // Handle sort change
  const handleSortChange = (field: string) => {
    const newSortBy = field
    const newSortOrder = sortBy === field 
      ? (sortOrder === 'asc' ? 'desc' : 'asc')
      : 'desc'
    
    setSortBy(newSortBy)
    setSortOrder(newSortOrder)
    setPagination((prev) => ({ ...prev, offset: 0 }))
    
    // Fetch with new sort parameters immediately - pass them directly to avoid state timing issues
    fetchSearches(true, undefined, undefined, newSortBy, newSortOrder)
  }

  // Reset filters
  const handleResetFilters = () => {
    const resetFilters = {
      email: '',
      startDate: '',
      endDate: '',
      minJobsFound: '',
      maxJobsFound: '',
      interrupted: '',
      interruptedReason: '',
    }
    setFilters(resetFilters)
    setPagination((prev) => ({ ...prev, offset: 0 }))
    // Use the reset filters directly in fetch calls to avoid async state issues
    fetchOverviewWithFilters(resetFilters)
    fetchSearchesWithFilters(true, undefined, undefined, undefined, undefined, resetFilters)
  }

  // Helper function to fetch overview with specific filters
  const fetchOverviewWithFilters = async (customFilters?: typeof filters) => {
    const filtersToUse = customFilters || filters
    try {
      setLoading(true)
      setError(null)
      const params: any = {}
      if (filtersToUse.email) params.email = filtersToUse.email
      if (filtersToUse.startDate) params.startDate = filtersToUse.startDate
      if (filtersToUse.endDate) params.endDate = filtersToUse.endDate
      if (filtersToUse.interrupted !== '') params.interrupted = filtersToUse.interrupted
      if (filtersToUse.interruptedReason !== '') params.interruptedReason = filtersToUse.interruptedReason
      if (filtersToUse.minJobsFound) params.minJobsFound = Number(filtersToUse.minJobsFound)
      if (filtersToUse.maxJobsFound) params.maxJobsFound = Number(filtersToUse.maxJobsFound)

      const response = await jobSearchAnalyticsAPI.getOverview(params)
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

  // Helper function to fetch searches with specific filters
  const fetchSearchesWithFilters = async (resetOffset = false, customLimit?: number, customOffset?: number, customSortBy?: string, customSortOrder?: 'asc' | 'desc', customFilters?: typeof filters) => {
    const filtersToUse = customFilters || filters
    try {
      setLoading(true)
      setError(null)
      const currentOffset = resetOffset ? 0 : (customOffset !== undefined ? customOffset : pagination.offset)
      const currentLimit = customLimit !== undefined ? customLimit : pagination.limit
      const sortByToUse = customSortBy !== undefined ? customSortBy : sortBy
      const sortOrderToUse = customSortOrder !== undefined ? customSortOrder : sortOrder
      const dateRange = getDateRangeFromPeriod(timePeriod)
      const params: any = {
        limit: currentLimit,
        offset: currentOffset,
        sortBy: sortByToUse,
        sortOrder: sortOrderToUse,
      }
      
      // Apply time period date range if no manual dates are set
      if (filtersToUse.startDate) {
        params.startDate = filtersToUse.startDate
      } else if (dateRange.startDate) {
        params.startDate = dateRange.startDate
      }
      if (filtersToUse.endDate) {
        params.endDate = filtersToUse.endDate
      } else if (dateRange.endDate) {
        params.endDate = dateRange.endDate
      }
      
      // Apply other filters
      if (filtersToUse.email) params.email = filtersToUse.email
      if (filtersToUse.minJobsFound) params.minJobsFound = filtersToUse.minJobsFound
      if (filtersToUse.maxJobsFound) params.maxJobsFound = filtersToUse.maxJobsFound
      if (filtersToUse.interrupted !== '') params.interrupted = filtersToUse.interrupted
      if (filtersToUse.interruptedReason !== '') params.interruptedReason = filtersToUse.interruptedReason

      const response = await jobSearchAnalyticsAPI.getFilteredSearches(params)
      if (response.success) {
        setSearches(response.data)
        if (response.pagination) {
          setPagination({
            total: response.pagination.total,
            limit: response.pagination.limit || currentLimit,
            offset: response.pagination.offset || currentOffset,
            hasMore: response.pagination.hasMore || false,
          })
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch searches')
      console.error('Error fetching searches:', err)
    } finally {
      setLoading(false)
    }
  }

  // View search details
  const handleViewDetails = async (search: JobSearch) => {
    setSelectedSearch(search)
    setDetailDialog(true)
    setDetailTab(0)
    setPrompts(null)
    setEditingPrompt(null)
    // Clear test prompts when opening a new item
    setTestTitles('')
    setTestLocations('')
    setTestResults(null)
    
    try {
      setDetailLoading(true)
      const response = await jobSearchAnalyticsAPI.getJobSearchById(search._id)
      if (response.success) {
        setSelectedSearch(response.data)
      }
      
      // Fetch prompts used for this search
      try {
        setLoadingPrompts(true)
        const promptsResponse = await promptAPI.getPromptForSearch(search._id)
        if (promptsResponse.success) {
          setPrompts(promptsResponse.data)
        }
      } catch (promptErr: any) {
        console.error('Error fetching prompts:', promptErr)
      } finally {
        setLoadingPrompts(false)
      }
    } catch (err: any) {
      console.error('Error fetching search details:', err)
    } finally {
      setDetailLoading(false)
    }
  }

  // Handle prompt editing
  const handleEditPrompt = (promptType: 'validateJobTitle' | 'validateLocation') => {
    const prompt = prompts?.[promptType]
    if (prompt) {
      setEditingPrompt(promptType)
      setEditedPromptContent(prompt.promptContent)
      setPromptDescription(`Improved ${promptType} prompt`)
    }
  }

  // Handle saving improved prompt
  const handleSavePrompt = async () => {
    if (!editingPrompt || !editedPromptContent.trim()) return

    try {
      setSavingPrompt(true)
      const response = await promptAPI.savePrompt({
        promptType: editingPrompt,
        promptContent: editedPromptContent.trim(),
        description: promptDescription.trim() || `Improved ${editingPrompt} prompt`
      })

      if (response.success) {
        // Refresh prompts
        if (selectedSearch) {
          const promptsResponse = await promptAPI.getPromptForSearch(selectedSearch._id)
          if (promptsResponse.success) {
            setPrompts(promptsResponse.data)
          }
        }
        setEditingPrompt(null)
        setEditedPromptContent('')
        setPromptDescription('')
      }
    } catch (err: any) {
      console.error('Error saving prompt:', err)
      setError(err.response?.data?.error || 'Failed to save prompt')
    } finally {
      setSavingPrompt(false)
    }
  }

  // Handle canceling prompt edit
  const handleCancelEdit = () => {
    setEditingPrompt(null)
    setEditedPromptContent('')
    setPromptDescription('')
  }

  // Handle testing prompts
  const handleTestPrompts = async () => {
    if (!testTitles.trim()) {
      setError('Please enter at least one title to test')
      return
    }

    const titles = testTitles.split('\n').map(t => t.trim()).filter(t => t.length > 0)
    const locations = testLocations.split('\n').map(l => l.trim()).filter(l => l.length > 0)

    try {
      setTestingPrompts(true)
      setError(null)
      const response = await promptAPI.testPrompts({
        originalTitles: titles,
        originalLocations: locations,
      })

      if (response.success) {
        setTestResults(response.data)
      }
    } catch (err: any) {
      console.error('Error testing prompts:', err)
      setError(err.response?.data?.error || 'Failed to test prompts')
    } finally {
      setTestingPrompts(false)
    }
  }

  // Load original titles and locations from selected search
  const handleLoadFromSearch = () => {
    if (selectedSearch) {
      const titles = selectedSearch.searchParams?.originalTitles || []
      const locations = selectedSearch.searchParams?.originalLocations || []
      setTestTitles(titles.join('\n'))
      setTestLocations(locations.join('\n'))
    }
  }

  // Handle testing job search with updated prompts
  const handleTestJobSearch = async () => {
    if (!selectedSearch) {
      setError('Please select a search first')
      return
    }

    const titles = selectedSearch.searchParams?.originalTitles || []
    const locations = selectedSearch.searchParams?.originalLocations || []
    const country = selectedSearch.searchParams?.country || 'us'
    const results = selectedSearch.results?.requested || selectedSearch.searchParams?.results || 50

    if (titles.length === 0) {
      setError('No titles found in selected search')
      return
    }

    try {
      setTestingJobSearch(true)
      setError(null)
      const response = await promptAPI.testJobSearch({
        titles,
        locations,
        country,
        results: results, // Use the actual results requested from the search
        timeFilter: selectedSearch.searchParams?.timeFilter || undefined,
        filtersForBackend: (selectedSearch.searchParams as any)?.filtersForBackend || {},
      })

      if (response.success) {
        setTestJobSearchResults(response.data)
      }
    } catch (err: any) {
      console.error('Error testing job search:', err)
      setError(err.response?.data?.error || 'Failed to test job search')
    } finally {
      setTestingJobSearch(false)
    }
  }

  // Fetch low return rate searches
  const fetchLowReturnRateSearches = async (resetOffset = false, customLimit?: number, customOffset?: number, customPercentage?: number, customFilters?: typeof filters) => {
    const filtersToUse = customFilters || filters
    try {
      setLowReturnRateLoading(true)
      setError(null)
      const currentOffset = resetOffset ? 0 : (customOffset !== undefined ? customOffset : lowReturnRatePagination.offset)
      const currentLimit = customLimit !== undefined ? customLimit : lowReturnRatePagination.limit
      const percentageToUse = customPercentage !== undefined ? customPercentage : lowReturnRatePercentage
      const dateRange = getDateRangeFromPeriod(timePeriod)
      const params: any = {
        limit: currentLimit,
        offset: currentOffset,
        percentage: percentageToUse,
        sortBy,
        sortOrder,
      }
      
      if (filtersToUse.email) params.email = filtersToUse.email
      if (filtersToUse.interrupted !== '') params.interrupted = filtersToUse.interrupted
      if (filtersToUse.interruptedReason !== '') params.interruptedReason = filtersToUse.interruptedReason
      // Apply time period date range if no manual dates are set
      if (filtersToUse.startDate) {
        params.startDate = filtersToUse.startDate
      } else if (dateRange.startDate) {
        params.startDate = dateRange.startDate
      }
      if (filtersToUse.endDate) {
        params.endDate = filtersToUse.endDate
      } else if (dateRange.endDate) {
        params.endDate = dateRange.endDate
      }

      const response = await jobSearchAnalyticsAPI.getLowReturnRateSearches(params)
      if (response.success) {
        setLowReturnRateSearches(response.data)
        if (response.pagination) {
          setLowReturnRatePagination({
            total: response.pagination.total,
            limit: response.pagination.limit || currentLimit,
            offset: response.pagination.offset || currentOffset,
            hasMore: response.pagination.hasMore || false,
          })
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch low return rate searches')
      console.error('Error fetching low return rate searches:', err)
    } finally {
      setLowReturnRateLoading(false)
    }
  }

  // Fetch low return rate analytics
  const fetchLowReturnRateAnalytics = async (customPercentage?: number, customFilters?: typeof filters) => {
    const filtersToUse = customFilters || filters
    try {
      setLowReturnRateLoading(true)
      setError(null)
      const percentageToUse = customPercentage !== undefined ? customPercentage : lowReturnRatePercentage
      const dateRange = getDateRangeFromPeriod(timePeriod)
      const params: any = {
        percentage: percentageToUse,
      }
      
      if (filtersToUse.email) params.email = filtersToUse.email
      if (filtersToUse.interrupted !== '') params.interrupted = filtersToUse.interrupted
      if (filtersToUse.interruptedReason !== '') params.interruptedReason = filtersToUse.interruptedReason
      // Apply time period date range if no manual dates are set
      if (filtersToUse.startDate) {
        params.startDate = filtersToUse.startDate
      } else if (dateRange.startDate) {
        params.startDate = dateRange.startDate
      }
      if (filtersToUse.endDate) {
        params.endDate = filtersToUse.endDate
      } else if (dateRange.endDate) {
        params.endDate = dateRange.endDate
      }

      const response = await jobSearchAnalyticsAPI.getLowReturnRateAnalytics(params)
      if (response.success) {
        setLowReturnRateAnalytics(response)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch low return rate analytics')
      console.error('Error fetching low return rate analytics:', err)
    } finally {
      setLowReturnRateLoading(false)
    }
  }

  // Handle low return rate percentage change
  const handlePercentageChange = async (newPercentage: number) => {
    setLowReturnRatePercentage(newPercentage)
    setLowReturnRatePagination((prev) => ({ ...prev, offset: 0 }))
    // Automatically fetch data when percentage changes - pass the new value directly
    await fetchLowReturnRateSearches(true, undefined, undefined, newPercentage)
    await fetchLowReturnRateAnalytics(newPercentage)
  }

  // Handle low return rate pagination
  const handleLowReturnRatePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    const newOffset = (page - 1) * lowReturnRatePagination.limit
    setLowReturnRatePagination((prev) => ({ ...prev, offset: newOffset }))
    fetchLowReturnRateSearches(false, undefined, newOffset)
  }

  // Handle time period change
  const handleTimePeriodChange = (period: 'all' | 'today' | '3days' | '7days' | '30days') => {
    setTimePeriod(period)
    setPagination((prev) => ({ ...prev, offset: 0 }))
    setLowReturnRatePagination((prev) => ({ ...prev, offset: 0 }))
    // Clear manual date filters when using time period
    setFilters((prev) => ({ ...prev, startDate: '', endDate: '' }))
  }

  // Initial data fetch - removed sortBy and sortOrder from dependencies to avoid double fetching
  // They are handled by handleSortChange which calls fetchSearches directly
  useEffect(() => {
    fetchOverviewWithFilters()
    fetchSearchesWithFilters(true)
  }, [pagination.limit, timePeriod])

  // Fetch low return rate data when main tab changes, percentage changes, or time period changes
  useEffect(() => {
    if (mainTab === 1) {
      fetchLowReturnRateSearches(true)
      fetchLowReturnRateAnalytics()
    }
  }, [mainTab, lowReturnRatePercentage, timePeriod])

  // Prepare chart data
  const platformData = overview?.platformDistribution || []
  const timeSeriesData = overview?.timeSeries.map((item) => ({
    date: item._id,
    searches: item.count,
    avgJobsFound: Math.round(item.avgJobsFound || 0),
    avgJobsReturned: Math.round(item.avgJobsReturned || 0),
  })) || []

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', backgroundColor: '#f5f5f5', width: '100%' }}>
      <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
        {/* Header with Time Period Selector */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
            Job Search Analytics
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

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Main Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={mainTab} onChange={(_, newValue) => setMainTab(newValue)}>
            <Tab label="All Searches" />
            <Tab label="Low Return Rate" />
          </Tabs>
        </Paper>

        {mainTab === 0 ? (
          <>
            {/* All Searches Tab Content */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <FilterListIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Filters</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
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
                    label="Min Jobs Found"
                    type="number"
                    value={filters.minJobsFound}
                    onChange={(e) => handleFilterChange('minJobsFound', e.target.value)}
                    size="small"
                  />
                </Box>
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(16.66% - 10px)' } }}>
                  <TextField
                    fullWidth
                    label="Max Jobs Found"
                    type="number"
                    value={filters.maxJobsFound}
                    onChange={(e) => handleFilterChange('maxJobsFound', e.target.value)}
                    size="small"
                  />
                </Box>
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(16.66% - 10px)' } }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Interrupted</InputLabel>
                    <Select
                      value={filters.interrupted}
                      label="Interrupted"
                      onChange={(e) => handleFilterChange('interrupted', e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="true">Interrupted</MenuItem>
                      <MenuItem value="false">Not Interrupted</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(16.66% - 10px)' } }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Interrupted Reason</InputLabel>
                    <Select
                      value={filters.interruptedReason}
                      label="Interrupted Reason"
                      onChange={(e) => handleFilterChange('interruptedReason', e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="page_unload">Page Refresh/Close</MenuItem>
                      <MenuItem value="new_search_started">New Search Started</MenuItem>
                      <MenuItem value="search_error">Search Error</MenuItem>
                      <MenuItem value="component_unmount">Component Unmounted</MenuItem>
                    </Select>
                  </FormControl>
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
                </Box>
              </Box>
            </Paper>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* Overview Cards */}
                {overview && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                    <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' } }}>
                      <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                        <CardContent>
                          <Typography color="inherit" gutterBottom variant="body2">
                            Total Searches
                          </Typography>
                          <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                            {overview.overview.totalSearches.toLocaleString()}
                          </Typography>
                          <SearchIcon sx={{ mt: 1, opacity: 0.8 }} />
                        </CardContent>
                      </Card>
                    </Box>
                    <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' } }}>
                      <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                        <CardContent>
                          <Typography color="inherit" gutterBottom variant="body2">
                            Total Jobs Found
                          </Typography>
                          <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                            {overview.overview.totalJobsFound.toLocaleString()}
                          </Typography>
                          <TrendingUpIcon sx={{ mt: 1, opacity: 0.8 }} />
                        </CardContent>
                      </Card>
                    </Box>
                    <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' } }}>
                      <Card sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
                        <CardContent>
                          <Typography color="inherit" gutterBottom variant="body2">
                            Avg Jobs per Search
                          </Typography>
                          <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                            {overview.overview.avgJobsFound.toFixed(1)}
                          </Typography>
                          <BarChartIcon sx={{ mt: 1, opacity: 0.8 }} />
                        </CardContent>
                      </Card>
                    </Box>
                    <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' } }}>
                      <Card sx={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
                        <CardContent>
                          <Typography color="inherit" gutterBottom variant="body2">
                            Avg Response Time
                          </Typography>
                          <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
                            {(overview.overview.avgResponseTime / 1000).toFixed(1)}s
                          </Typography>
                          <SpeedIcon sx={{ mt: 1, opacity: 0.8 }} />
                        </CardContent>
                      </Card>
                    </Box>
                  </Box>
                )}

                {/* Charts Section */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                  <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
                    <Paper sx={{ p: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        Searches Over Time
                      </Typography>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={timeSeriesData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="searches" stroke="#8884d8" name="Searches" />
                          <Line type="monotone" dataKey="avgJobsFound" stroke="#82ca9d" name="Avg Jobs Found" />
                        </LineChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Box>
                  <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
                    <Paper sx={{ p: 3 }}>
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
                            outerRadius={100}
                            label
                          >
                            {platformData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Box>
                </Box>

                {/* Searches Table */}
                <Paper sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Job Searches ({pagination.total > 0 ? pagination.total : searches.length})
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
                            fetchSearches(true, newLimit)
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
                  <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ minWidth: 150 }}>
                            <TableSortLabel
                              active={sortBy === 'email'}
                              direction={sortBy === 'email' ? sortOrder : 'asc'}
                              onClick={() => handleSortChange('email')}
                            >
                              Email
                            </TableSortLabel>
                          </TableCell>
                          <TableCell sx={{ minWidth: 200, maxWidth: 250 }}>Search Titles</TableCell>
                          <TableCell sx={{ minWidth: 150, maxWidth: 200 }}>Locations</TableCell>
                          <TableCell>Requested</TableCell>
                          <TableCell>
                            <TableSortLabel
                              active={sortBy === 'results.found'}
                              direction={sortBy === 'results.found' ? sortOrder : 'asc'}
                              onClick={() => handleSortChange('results.found')}
                            >
                              Jobs Found
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>Jobs Returned</TableCell>
                          <TableCell>Return Rate</TableCell>
                          <TableCell>Interrupted</TableCell>
                          <TableCell>Interrupted Reason</TableCell>
                          <TableCell>Platform Breakdown</TableCell>
                          <TableCell>
                            <TableSortLabel
                              active={sortBy === 'performance.responseTime'}
                              direction={sortBy === 'performance.responseTime' ? sortOrder : 'asc'}
                              onClick={() => handleSortChange('performance.responseTime')}
                            >
                              Response Time
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>
                            <TableSortLabel
                              active={sortBy === 'createdAt'}
                              direction={sortBy === 'createdAt' ? sortOrder : 'asc'}
                              onClick={() => handleSortChange('createdAt')}
                            >
                              Date
                            </TableSortLabel>
                          </TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {searches.map((search) => (
                          <TableRow
                            key={search._id}
                            hover
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell onClick={() => handleViewDetails(search)}>{search.email}</TableCell>
                        <TableCell onClick={() => handleViewDetails(search)} sx={{ maxWidth: 250 }}>
                          <Box sx={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: 0.5,
                            maxWidth: '100%'
                          }}>
                            {search.searchParams?.originalTitles?.slice(0, 2).map((title, idx) => (
                              <Chip 
                                key={idx} 
                                label={title.length > 15 ? `${title.substring(0, 15)}...` : title} 
                                size="small" 
                                variant="outlined"
                                title={title}
                                sx={{ fontSize: '0.7rem' }}
                              />
                            ))}
                            {search.searchParams?.originalTitles?.length > 2 && (
                              <Chip label={`+${search.searchParams.originalTitles.length - 2}`} size="small" sx={{ fontSize: '0.7rem' }} />
                            )}
                          </Box>
                        </TableCell>
                        <TableCell onClick={() => handleViewDetails(search)} sx={{ maxWidth: 200 }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '100%'
                            }}
                            title={search.searchParams?.originalLocations?.join(', ') || 'N/A'}
                          >
                            {search.searchParams?.originalLocations?.join(', ') || 'N/A'}
                          </Typography>
                        </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              {search.results?.requested || 0}
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              {search.results?.found || 0}
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              {search.results?.returned || 0}
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              {search.results?.requested && search.results.requested > 0
                                ? `${((search.results?.found || 0) / search.results.requested * 100).toFixed(1)}%`
                                : 'N/A'}
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              <Chip 
                                label={search.interrupted ? 'Yes' : 'No'} 
                                size="small" 
                                color={search.interrupted ? 'error' : 'success'}
                              />
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              {getInterruptedReasonLabel(search.interruptedReason)}
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {search.platformBreakdown?.greenhouse > 0 && (
                                  <Chip label={`GH: ${search.platformBreakdown.greenhouse}`} size="small" color="primary" />
                                )}
                                {search.platformBreakdown?.lever > 0 && (
                                  <Chip label={`LV: ${search.platformBreakdown.lever}`} size="small" color="secondary" />
                                )}
                                {search.platformBreakdown?.ashbyhq > 0 && (
                                  <Chip label={`AS: ${search.platformBreakdown.ashbyhq}`} size="small" color="success" />
                                )}
                                {search.platformBreakdown?.rippling > 0 && (
                                  <Chip label={`RP: ${search.platformBreakdown.rippling}`} size="small" color="warning" />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              {((search.performance?.responseTime || 0) / 1000).toFixed(1)}s
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              {new Date(search.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              <Chip 
                                label={search.status || 'success'} 
                                size="small" 
                                color={search.status === 'success' ? 'success' : 'error'}
                              />
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <IconButton
                                size="small"
                                onClick={() => handleViewDetails(search)}
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
        ) : (
          <>
            {/* Low Return Rate Tab Content */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FilterListIcon sx={{ mr: 1 }} />
                  <Typography variant="h6">Filters</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ mr: 1 }}>Return Rate Threshold:</Typography>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={lowReturnRatePercentage}
                      onChange={async (e: any) => {
                        await handlePercentageChange(Number(e.target.value))
                      }}
                    >
                      <MenuItem value={0}>0% (No Jobs)</MenuItem>
                      <MenuItem value={20}>20%</MenuItem>
                      <MenuItem value={50}>50%</MenuItem>
                      <MenuItem value={75}>75%</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
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
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(25% - 12px)' } }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Interrupted</InputLabel>
                    <Select
                      value={filters.interrupted}
                      label="Interrupted"
                      onChange={(e) => handleFilterChange('interrupted', e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="true">Interrupted</MenuItem>
                      <MenuItem value="false">Not Interrupted</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(25% - 12px)' } }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Interrupted Reason</InputLabel>
                    <Select
                      value={filters.interruptedReason}
                      label="Interrupted Reason"
                      onChange={(e) => handleFilterChange('interruptedReason', e.target.value)}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="page_unload">Page Refresh/Close</MenuItem>
                      <MenuItem value="new_search_started">New Search Started</MenuItem>
                      <MenuItem value="search_error">Search Error</MenuItem>
                      <MenuItem value="component_unmount">Component Unmounted</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ width: { xs: '100%', sm: '100%', md: 'calc(50% - 8px)' }, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Button
                    variant="contained"
                    onClick={async () => {
                      setLowReturnRatePagination((prev) => ({ ...prev, offset: 0 }))
                      await fetchLowReturnRateSearches(true)
                      await fetchLowReturnRateAnalytics()
                    }}
                    startIcon={<FilterListIcon />}
                  >
                    Apply Filters
                  </Button>
                  <Button variant="outlined" onClick={() => {
                    const resetFilters = {
                      email: '',
                      startDate: '',
                      endDate: '',
                      minJobsFound: '',
                      maxJobsFound: '',
                      interrupted: '',
                      interruptedReason: '',
                    }
                    setFilters(resetFilters)
                    setLowReturnRatePagination((prev) => ({ ...prev, offset: 0 }))
                    // Use the reset filters directly in fetch calls to avoid async state issues
                    fetchLowReturnRateSearches(true, undefined, undefined, undefined, resetFilters)
                    fetchLowReturnRateAnalytics(undefined, resetFilters)
                  }}>
                    Reset
                  </Button>
                </Box>
              </Box>
            </Paper>

            {/* Analytics Summary */}
            {lowReturnRateLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : lowReturnRateAnalytics?.data ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                <Box sx={{ width: { xs: '100%', md: 'calc(33.33% - 16px)' } }}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Total Low Return Searches
                      </Typography>
                      <Typography variant="h5">
                        {lowReturnRateAnalytics.data?.totalSearches || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ width: { xs: '100%', md: 'calc(33.33% - 16px)' } }}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Unique Search Terms
                      </Typography>
                      <Typography variant="h5">
                        {lowReturnRateAnalytics.data?.searchTerms?.length || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
                <Box sx={{ width: { xs: '100%', md: 'calc(33.33% - 16px)' } }}>
                  <Card>
                    <CardContent>
                      <Typography color="text.secondary" gutterBottom>
                        Unique Locations
                      </Typography>
                      <Typography variant="h5">
                        {lowReturnRateAnalytics.data?.locations?.length || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              </Box>
            ) : null}

            {/* Analytics Breakdown */}
            {lowReturnRateAnalytics?.data && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                {/* Search Terms */}
                <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Top Search Terms with Low Return Rate
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Search Term</TableCell>
                            <TableCell align="right">Count</TableCell>
                            <TableCell align="right">Avg Return %</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {lowReturnRateAnalytics.data?.searchTerms?.slice(0, 10).map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell>{item.term}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                              <TableCell align="right">
                                <Typography color={item.avgReturnRate < 20 ? 'error' : 'text.secondary'}>
                                  {item.avgReturnRate.toFixed(1)}%
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Box>

                {/* Locations */}
                <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Top Locations with Low Return Rate
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Location</TableCell>
                            <TableCell align="right">Count</TableCell>
                            <TableCell align="right">Avg Return %</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {lowReturnRateAnalytics.data?.locations?.slice(0, 10).map((item: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell>{item.location}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                              <TableCell align="right">
                                <Typography color={item.avgReturnRate < 20 ? 'error' : 'text.secondary'}>
                                  {item.avgReturnRate.toFixed(1)}%
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Box>

                {/* Filters */}
                <Box sx={{ width: { xs: '100%', md: 'calc(33.33% - 16px)' } }}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Time Filters
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Filter</TableCell>
                            <TableCell align="right">Count</TableCell>
                            <TableCell align="right">Avg Return %</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.keys(lowReturnRateAnalytics.data?.filters?.timeFilter || {}).slice(0, 5).map((key) => {
                            const stat = lowReturnRateAnalytics.data.filters.timeFilter[key]
                            return (
                              <TableRow key={key}>
                                <TableCell>{key} ({getTimeFilterLabel(key)})</TableCell>
                                <TableCell align="right">{stat.count}</TableCell>
                                <TableCell align="right">{stat.avgReturnRate.toFixed(1)}%</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Box>

                <Box sx={{ width: { xs: '100%', md: 'calc(33.33% - 16px)' } }}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Work Types
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Work Type</TableCell>
                            <TableCell align="right">Count</TableCell>
                            <TableCell align="right">Avg Return %</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.keys(lowReturnRateAnalytics.data?.filters?.workType || {}).slice(0, 5).map((key) => {
                            const stat = lowReturnRateAnalytics.data.filters.workType[key]
                            return (
                              <TableRow key={key}>
                                <TableCell>{key || 'Not Specified'}</TableCell>
                                <TableCell align="right">{stat.count}</TableCell>
                                <TableCell align="right">{stat.avgReturnRate.toFixed(1)}%</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Box>

                <Box sx={{ width: { xs: '100%', md: 'calc(33.33% - 16px)' } }}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Countries
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Country</TableCell>
                            <TableCell align="right">Count</TableCell>
                            <TableCell align="right">Avg Return %</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.keys(lowReturnRateAnalytics.data?.filters?.country || {}).slice(0, 5).map((key) => {
                            const stat = lowReturnRateAnalytics.data.filters.country[key]
                            return (
                              <TableRow key={key}>
                                <TableCell>{key}</TableCell>
                                <TableCell align="right">{stat.count}</TableCell>
                                <TableCell align="right">{stat.avgReturnRate.toFixed(1)}%</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Box>

                {/* Top Interrupted Reasons */}
                <Box sx={{ width: { xs: '100%', md: 'calc(50% - 12px)' } }}>
                  <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Top Interrupted Reasons
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Interrupted Reason</TableCell>
                            <TableCell align="right">Count</TableCell>
                            <TableCell align="right">Avg Return %</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {lowReturnRateAnalytics.data?.interruptedReasons && lowReturnRateAnalytics.data.interruptedReasons.length > 0 ? (
                            lowReturnRateAnalytics.data.interruptedReasons.slice(0, 10).map((item: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell>{getInterruptedReasonLabel(item.reason)}</TableCell>
                                <TableCell align="right">{item.count}</TableCell>
                                <TableCell align="right">{item.avgReturnRate.toFixed(1)}%</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={3} align="center">
                                <Typography variant="body2" color="text.secondary">
                                  No interrupted searches found
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Box>
              </Box>
            )}

            {/* Low Return Rate Searches Table */}
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Low Return Rate Searches ({lowReturnRatePagination.total > 0 ? lowReturnRatePagination.total : lowReturnRateSearches.length})
                  {lowReturnRatePercentage > 0 && (
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      (&lt; {lowReturnRatePercentage}% of requested)
                    </Typography>
                  )}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Items per page</InputLabel>
                    <Select
                      value={lowReturnRatePagination.limit}
                      label="Items per page"
                      onChange={(e: any) => {
                        const newLimit = Number(e.target.value)
                        setLowReturnRatePagination((prev) => ({ ...prev, limit: newLimit, offset: 0 }))
                        fetchLowReturnRateSearches(true, newLimit)
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
              {lowReturnRateLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ minWidth: 150 }}>Email</TableCell>
                          <TableCell sx={{ minWidth: 200, maxWidth: 250 }}>Search Titles</TableCell>
                          <TableCell sx={{ minWidth: 150, maxWidth: 200 }}>Locations</TableCell>
                          <TableCell align="right" sx={{ minWidth: 100 }}>Requested</TableCell>
                          <TableCell align="right" sx={{ minWidth: 100 }}>Found</TableCell>
                          <TableCell align="right" sx={{ minWidth: 120 }}>Return Rate</TableCell>
                          <TableCell sx={{ minWidth: 100 }}>Interrupted</TableCell>
                          <TableCell sx={{ minWidth: 150 }}>Interrupted Reason</TableCell>
                          <TableCell sx={{ minWidth: 120 }}>Date</TableCell>
                          <TableCell sx={{ minWidth: 80 }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {lowReturnRateSearches.map((search: any) => (
                          <TableRow
                            key={search._id}
                            hover
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell onClick={() => handleViewDetails(search)}>{search.email}</TableCell>
                            <TableCell onClick={() => handleViewDetails(search)} sx={{ maxWidth: 250 }}>
                              <Box sx={{ 
                                display: 'flex', 
                                flexWrap: 'wrap', 
                                gap: 0.5,
                                maxWidth: '100%'
                              }}>
                                {search.searchParams?.originalTitles?.slice(0, 2).map((title: string, idx: number) => (
                                  <Chip 
                                    key={idx} 
                                    label={title.length > 15 ? `${title.substring(0, 15)}...` : title} 
                                    size="small" 
                                    variant="outlined"
                                    title={title}
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                ))}
                                {search.searchParams?.originalTitles?.length > 2 && (
                                  <Chip label={`+${search.searchParams.originalTitles.length - 2}`} size="small" sx={{ fontSize: '0.7rem' }} />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)} sx={{ maxWidth: 200 }}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '100%'
                                }}
                                title={search.searchParams?.originalLocations?.join(', ') || 'N/A'}
                              >
                                {search.searchParams?.originalLocations?.join(', ') || 'N/A'}
                              </Typography>
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              {search.results?.requested || 0}
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              <Typography color="error.main" fontWeight="bold">
                                {search.results?.found || 0}
                              </Typography>
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              <Typography 
                                color={search.returnRate < 20 ? 'error.main' : 'warning.main'}
                                fontWeight="bold"
                              >
                                {search.returnRate?.toFixed(1) || 0}%
                              </Typography>
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              <Chip 
                                label={search.interrupted ? 'Yes' : 'No'} 
                                size="small" 
                                color={search.interrupted ? 'error' : 'success'}
                              />
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: 150
                                }}
                                title={getInterruptedReasonLabel(search.interruptedReason)}
                              >
                                {getInterruptedReasonLabel(search.interruptedReason)}
                              </Typography>
                            </TableCell>
                            <TableCell onClick={() => handleViewDetails(search)}>
                              {new Date(search.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <IconButton
                                size="small"
                                onClick={() => handleViewDetails(search)}
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
                  {lowReturnRatePagination.total > lowReturnRatePagination.limit && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                      <Pagination
                        count={Math.ceil(lowReturnRatePagination.total / lowReturnRatePagination.limit)}
                        page={Math.floor(lowReturnRatePagination.offset / lowReturnRatePagination.limit) + 1}
                        onChange={handleLowReturnRatePageChange}
                        color="primary"
                        showFirstButton
                        showLastButton
                      />
                    </Box>
                  )}
                </>
              )}
            </Paper>
          </>
        )}
      </Container>

      {/* Detail View Dialog - Shared across both tabs */}
      <Dialog
        open={detailDialog}
        onClose={() => setDetailDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Job Search Details</Typography>
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
          {selectedSearch && !detailLoading && (
            <Box>
              <Tabs value={detailTab} onChange={(_, newValue) => setDetailTab(newValue)}>
                <Tab label="Overview" />
                <Tab label="Search Params" />
                <Tab label="Query" />
                <Tab label="Results" />
                <Tab label="Performance" />
                <Tab label="Prompts" />
                <Tab label="Raw JSON" />
              </Tabs>
              <Divider sx={{ mb: 2 }} />
              
              {detailTab === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Search Information</Typography>
                  <List>
                    <ListItem>
                      <ListItemText primary="Email" secondary={selectedSearch.email} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Session ID" secondary={selectedSearch.searchSessionId} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Status" secondary={selectedSearch.status} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Created At" secondary={new Date(selectedSearch.createdAt).toLocaleString()} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Updated At" secondary={new Date(selectedSearch.updatedAt).toLocaleString()} />
                    </ListItem>
                  </List>
                </Box>
              )}

              {detailTab === 1 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Search Parameters</Typography>
                  <List>
                    <ListItem>
                      <ListItemText 
                        primary="Original Titles" 
                        secondary={selectedSearch.searchParams?.originalTitles?.join(', ') || 'N/A'} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Validated Titles" 
                        secondary={selectedSearch.validatedParams?.validatedTitles?.join(', ') || 'N/A'} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Original Locations" 
                        secondary={selectedSearch.searchParams?.originalLocations?.join(', ') || 'N/A'} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Validated Locations" 
                        secondary={selectedSearch.validatedParams?.validatedLocations?.join(', ') || 'N/A'} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Country" secondary={selectedSearch.searchParams?.country || 'N/A'} />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Time Filter" 
                        secondary={
                          selectedSearch.searchParams?.timeFilter 
                            ? `${selectedSearch.searchParams.timeFilter} (${getTimeFilterLabel(selectedSearch.searchParams.timeFilter)})`
                            : 'N/A'
                        } 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Results Requested" secondary={selectedSearch.results?.requested || 0} />
                    </ListItem>
                  </List>
                </Box>
              )}

              {detailTab === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Query Information</Typography>
                  <List>
                    <ListItem>
                      <ListItemText 
                        primary="Final Query" 
                        secondary={
                          <Typography 
                            component="span" 
                            sx={{ 
                              fontFamily: 'monospace',
                              fontSize: '0.875rem',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap'
                            }}
                          >
                            {selectedSearch.query?.finalQuery || 'N/A'}
                          </Typography>
                        }
                      />
                    </ListItem>
                  </List>
                  
                  {selectedSearch.query?.queryDetails && (
                    <>
                      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Query Details</Typography>
                      <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', maxHeight: 400, overflow: 'auto' }}>
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
                          {JSON.stringify(selectedSearch.query.queryDetails, null, 2)}
                        </Typography>
                      </Paper>
                    </>
                  )}
                  
                  {selectedSearch.query && Object.keys(selectedSearch.query).length > 0 && (
                    <>
                      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>Full Query Object</Typography>
                      <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', maxHeight: 400, overflow: 'auto' }}>
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
                          {JSON.stringify(selectedSearch.query, null, 2)}
                        </Typography>
                      </Paper>
                    </>
                  )}
                </Box>
              )}

              {detailTab === 3 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Search Results</Typography>
                  <List>
                    <ListItem>
                      <ListItemText primary="Jobs Requested" secondary={selectedSearch.results?.requested || 0} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Jobs Needed" secondary={selectedSearch.results?.needed || 0} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Jobs Found" secondary={selectedSearch.results?.found || 0} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Jobs Returned" secondary={selectedSearch.results?.returned || 0} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Pages Fetched" secondary={selectedSearch.results?.pagesFetched || 0} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Applied Jobs Count" secondary={selectedSearch.results?.appliedJobsCount || 0} />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Filtered Out" 
                        secondary={`Total: ${selectedSearch.results?.filteredOut?.total || 0} (Applied: ${selectedSearch.results?.filteredOut?.appliedJobs || 0}, Excluded: ${selectedSearch.results?.filteredOut?.excludedCompanies || 0})`} 
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Platform Breakdown" 
                        secondary={`Greenhouse: ${selectedSearch.platformBreakdown?.greenhouse || 0}, Lever: ${selectedSearch.platformBreakdown?.lever || 0}, Ashbyhq: ${selectedSearch.platformBreakdown?.ashbyhq || 0}, Rippling: ${selectedSearch.platformBreakdown?.rippling || 0}, Other: ${selectedSearch.platformBreakdown?.other || 0}`} 
                      />
                    </ListItem>
                  </List>
                </Box>
              )}

              {detailTab === 4 && (
                <Box>
                  <Typography variant="h6" gutterBottom>Performance Metrics</Typography>
                  <List>
                    <ListItem>
                      <ListItemText primary="Response Time" secondary={`${((selectedSearch.performance?.responseTime || 0) / 1000).toFixed(2)}s`} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Validation Time" secondary={`${((selectedSearch.performance?.validationTime || 0) / 1000).toFixed(2)}s`} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Total API Calls" secondary={selectedSearch.performance?.apiCalls?.total || 0} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="ScrapingDog Calls" secondary={selectedSearch.performance?.apiCalls?.scrapingDog || 0} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="OpenAI Calls" secondary={selectedSearch.performance?.apiCalls?.openai || 0} />
                    </ListItem>
                  </List>
                </Box>
              )}

              {detailTab === 5 && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                    AI Prompts Used for Validation
                  </Typography>

                  {/* Test Prompts Section */}
                  <Paper sx={{ p: 3, mb: 3, backgroundColor: '#f9f9f9' }}>
                    <Typography variant="h6" gutterBottom>
                      Test Prompts with Original Titles & Locations
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Simulate the validation process using the current active prompts. Enter titles and locations (one per line) or load from the selected search.
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleLoadFromSearch}
                        disabled={!selectedSearch}
                      >
                        Load from Search
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleTestPrompts}
                        disabled={testingPrompts || !testTitles.trim()}
                      >
                        {testingPrompts ? <CircularProgress size={20} /> : 'Run Test'}
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          setTestTitles('')
                          setTestLocations('')
                          setTestResults(null)
                        }}
                      >
                        Clear
                      </Button>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <Box sx={{ flex: 1 }}>
                        <TextField
                          fullWidth
                          label="Original Titles (one per line)"
                          multiline
                          rows={4}
                          value={testTitles}
                          onChange={(e) => setTestTitles(e.target.value)}
                          placeholder="software engineer&#10;data scientist&#10;product manager"
                        />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <TextField
                          fullWidth
                          label="Original Locations (one per line)"
                          multiline
                          rows={4}
                          value={testLocations}
                          onChange={(e) => setTestLocations(e.target.value)}
                          placeholder="Remote&#10;New York&#10;San Francisco"
                        />
                      </Box>
                    </Box>

                    {testResults && (
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="h6" gutterBottom>
                          Test Results
                        </Typography>
                        
                        {/* Title Results */}
                        <Paper sx={{ p: 2, mb: 2, backgroundColor: '#fff' }}>
                          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                            Title Validation Results
                          </Typography>
                          {testResults.titleResults?.map((result: any, idx: number) => (
                            <Box key={idx} sx={{ mb: 2, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>Original:</strong> {result.originalTitle}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Main Title:</strong> {result.validated?.mainTitle || 'N/A'}
                              </Typography>
                              {result.validated?.alternateTitles && result.validated.alternateTitles.length > 0 && (
                                <Typography variant="body2">
                                  <strong>Alternate Titles:</strong> {result.validated.alternateTitles.join(', ')}
                                </Typography>
                              )}
                              {result.validated?.locations && result.validated.locations.length > 0 && (
                                <Typography variant="body2" color="primary">
                                  <strong>Extracted Locations:</strong> {result.validated.locations.join(', ')}
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Paper>

                        {/* Location Results */}
                        {testResults.locationResults && testResults.locationResults.length > 0 && (
                          <Paper sx={{ p: 2, mb: 2, backgroundColor: '#fff' }}>
                            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                              Location Validation Results
                            </Typography>
                            {testResults.locationResults.map((result: any, idx: number) => (
                              <Box key={idx} sx={{ mb: 1, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                                <Typography variant="body2">
                                  <strong>Original:</strong> {result.originalLocation} → <strong>Validated:</strong> {result.validated}
                                  <Chip label={result.source} size="small" sx={{ ml: 1 }} />
                                </Typography>
                              </Box>
                            ))}
                          </Paper>
                        )}

                        {/* Final Output */}
                        <Paper sx={{ p: 2, backgroundColor: '#e3f2fd' }}>
                          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                            Final Validated Output
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Validated Titles ({testResults.output?.validatedTitles?.length || 0}):</strong>
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                            {testResults.output?.validatedTitles?.map((title: string, idx: number) => (
                              <Chip key={idx} label={title} size="small" color="primary" />
                            ))}
                          </Box>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Validated Locations ({testResults.output?.validatedLocations?.length || 0}):</strong>
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {testResults.output?.validatedLocations?.map((location: string, idx: number) => (
                              <Chip key={idx} label={location} size="small" color="secondary" />
                            ))}
                          </Box>
                        </Paper>
                      </Box>
                    )}
                  </Paper>

                  {/* Test Job Search Section */}
                  <Paper sx={{ p: 3, mb: 3, backgroundColor: '#fff3cd' }}>
                    <Typography variant="h6" gutterBottom>
                      Test Job Search with Updated Prompts
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Run the actual job search with the current active prompts to see how many jobs would be found. This uses the selected search's parameters.
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <Button
                        variant="contained"
                        color="warning"
                        onClick={handleTestJobSearch}
                        disabled={testingJobSearch || !selectedSearch}
                      >
                        {testingJobSearch ? <CircularProgress size={20} /> : 'Test Job Search'}
                      </Button>
                      {testJobSearchResults && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setTestJobSearchResults(null)}
                        >
                          Clear Results
                        </Button>
                      )}
                    </Box>

                    {testJobSearchResults && (
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="h6" gutterBottom>
                          Job Search Test Results
                        </Typography>
                        
                        <Paper sx={{ p: 2, mb: 2, backgroundColor: '#fff' }}>
                          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                            Input Parameters
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Original Titles:</strong> {testJobSearchResults.input?.originalTitles?.join(', ')}
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Original Locations:</strong> {testJobSearchResults.input?.originalLocations?.join(', ') || 'None'}
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Country:</strong> {testJobSearchResults.input?.country}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Results Requested:</strong> {testJobSearchResults.input?.results}
                          </Typography>
                        </Paper>

                        <Paper sx={{ p: 2, mb: 2, backgroundColor: '#fff' }}>
                          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                            Validated Parameters
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Validated Titles ({testJobSearchResults.validated?.validatedTitles?.length || 0}):</strong>
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                            {testJobSearchResults.validated?.validatedTitles?.map((title: string, idx: number) => (
                              <Chip key={idx} label={title} size="small" color="primary" />
                            ))}
                          </Box>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Validated Locations ({testJobSearchResults.validated?.validatedLocations?.length || 0}):</strong>
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {testJobSearchResults.validated?.validatedLocations?.map((location: string, idx: number) => (
                              <Chip key={idx} label={location} size="small" color="secondary" />
                            ))}
                          </Box>
                        </Paper>

                        <Paper sx={{ p: 2, backgroundColor: testJobSearchResults.results?.jobsFound > 0 ? '#d4edda' : '#f8d7da' }}>
                          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                            Search Results
                          </Typography>
                          <Typography variant="h4" sx={{ mb: 1, color: testJobSearchResults.results?.jobsFound > 0 ? 'success.main' : 'error.main' }}>
                            {testJobSearchResults.results?.jobsFound || 0} Jobs Found
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            <strong>Jobs Returned:</strong> {testJobSearchResults.results?.jobsReturned || 0}
                          </Typography>
                          {testJobSearchResults.results?.totalAvailable && (
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Total Available (Estimate):</strong> {testJobSearchResults.results.totalAvailable.toLocaleString()}
                            </Typography>
                          )}
                          <Typography variant="body2">
                            <strong>Response Time:</strong> {((testJobSearchResults.performance?.responseTime || 0) / 1000).toFixed(2)}s
                          </Typography>
                        </Paper>

                        {testJobSearchResults.query && (
                          <Paper sx={{ p: 2, mt: 2, backgroundColor: '#f5f5f5' }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Search Query Used
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.875rem',
                                wordBreak: 'break-word',
                              }}
                            >
                              {testJobSearchResults.query.searchQuery}
                            </Typography>
                          </Paper>
                        )}
                      </Box>
                    )}
                  </Paper>
                  
                  {loadingPrompts ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : prompts ? (
                    <>
                      {/* Validate Job Title Prompt */}
                      <Paper sx={{ p: 3, mb: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Box>
                            <Typography variant="h6">Validate Job Title Prompt</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {prompts.validateJobTitle?.isDefault ? 'Default Prompt' : `Custom Version ${prompts.validateJobTitle?.version || ''}`}
                            </Typography>
                          </Box>
                          {!editingPrompt && (
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleEditPrompt('validateJobTitle')}
                            >
                              Edit & Improve
                            </Button>
                          )}
                        </Box>
                        
                        {editingPrompt === 'validateJobTitle' ? (
                          <Box>
                            <TextField
                              fullWidth
                              multiline
                              rows={15}
                              value={editedPromptContent}
                              onChange={(e) => setEditedPromptContent(e.target.value)}
                              sx={{ mb: 2, fontFamily: 'monospace', fontSize: '0.875rem' }}
                            />
                            <TextField
                              fullWidth
                              label="Description (optional)"
                              value={promptDescription}
                              onChange={(e) => setPromptDescription(e.target.value)}
                              sx={{ mb: 2 }}
                              placeholder="Describe what improvements you made..."
                            />
                            <Box sx={{ display: 'flex', gap: 2 }}>
                              <Button
                                variant="contained"
                                onClick={handleSavePrompt}
                                disabled={savingPrompt || !editedPromptContent.trim()}
                              >
                                {savingPrompt ? <CircularProgress size={20} /> : 'Save Improved Prompt'}
                              </Button>
                              <Button
                                variant="outlined"
                                onClick={handleCancelEdit}
                                disabled={savingPrompt}
                              >
                                Cancel
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', maxHeight: 400, overflow: 'auto' }}>
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
                              {prompts.validateJobTitle?.promptContent || 'Loading...'}
                            </Typography>
                          </Paper>
                        )}
                      </Paper>

                      {/* Validate Location Prompt */}
                      <Paper sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Box>
                            <Typography variant="h6">Validate Location Prompt</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {prompts.validateLocation?.isDefault ? 'Default Prompt' : `Custom Version ${prompts.validateLocation?.version || ''}`}
                            </Typography>
                          </Box>
                          {!editingPrompt && (
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleEditPrompt('validateLocation')}
                            >
                              Edit & Improve
                            </Button>
                          )}
                        </Box>
                        
                        {editingPrompt === 'validateLocation' ? (
                          <Box>
                            <TextField
                              fullWidth
                              multiline
                              rows={10}
                              value={editedPromptContent}
                              onChange={(e) => setEditedPromptContent(e.target.value)}
                              sx={{ mb: 2, fontFamily: 'monospace', fontSize: '0.875rem' }}
                            />
                            <TextField
                              fullWidth
                              label="Description (optional)"
                              value={promptDescription}
                              onChange={(e) => setPromptDescription(e.target.value)}
                              sx={{ mb: 2 }}
                              placeholder="Describe what improvements you made..."
                            />
                            <Box sx={{ display: 'flex', gap: 2 }}>
                              <Button
                                variant="contained"
                                onClick={handleSavePrompt}
                                disabled={savingPrompt || !editedPromptContent.trim()}
                              >
                                {savingPrompt ? <CircularProgress size={20} /> : 'Save Improved Prompt'}
                              </Button>
                              <Button
                                variant="outlined"
                                onClick={handleCancelEdit}
                                disabled={savingPrompt}
                              >
                                Cancel
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <Paper sx={{ p: 2, backgroundColor: '#f5f5f5', maxHeight: 300, overflow: 'auto' }}>
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
                              {prompts.validateLocation?.promptContent || 'Loading...'}
                            </Typography>
                          </Paper>
                        )}
                      </Paper>
                    </>
                  ) : (
                    <Alert severity="info">Unable to load prompts for this search.</Alert>
                  )}
                </Box>
              )}

              {detailTab === 6 && (
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
                      {JSON.stringify(selectedSearch, null, 2)}
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
    </Box>
  )
}

