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
  Link as MuiLink,
  Card,
  CardContent,
  Grid,
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
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import {
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  SmartToy as SmartToyIcon,
} from '@mui/icons-material'
import { analyticsAPI } from '../services/api'

interface JobLink {
  _id: string
  email: string
  platform: string
  url: string
  timestamp: string
  analysis: {
    totalFields: number
    filledFields: number
    unfilledFields: number
  }
  completionRate: number
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

export default function JobLinks() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jobLinks, setJobLinks] = useState<JobLink[]>([])
  const [stats, setStats] = useState<any>(null)
  
  // Time period selector
  const [timePeriod, setTimePeriod] = useState<'all' | 'today' | '3days' | '7days' | '30days'>('3days')
  
  const [platform, setPlatform] = useState('all')
  const [email, setEmail] = useState('')
  const [totalLimit, setTotalLimit] = useState(100)
  const [perEmailLimit, setPerEmailLimit] = useState(5)

  // Detail view states
  const [detailDialog, setDetailDialog] = useState(false)
  const [selectedApplication, setSelectedApplication] = useState<any>(null)
  const [detailTab, setDetailTab] = useState(0)
  const [showJsonView, setShowJsonView] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  
  // AI Analysis states
  const [individualAILoading, setIndividualAILoading] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)

  const fetchJobLinks = async () => {
    try {
      setLoading(true)
      setError(null)
      const dateRange = getDateRangeFromPeriod(timePeriod)
      const params: any = {
        limit: totalLimit,
        perEmailLimit: perEmailLimit,
      }
      
      if (platform && platform !== 'all') {
        params.platform = platform
      }
      
      if (email) {
        params.email = email
      }

      // Apply time period date range
      if (dateRange.startDate) {
        params.startDate = dateRange.startDate
      }
      if (dateRange.endDate) {
        params.endDate = dateRange.endDate
      }

      const response = await analyticsAPI.getJobLinksByPlatform(params)
      if (response.success) {
        setJobLinks(response.data)
        setStats(response.stats)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch job links')
      console.error('Error fetching job links:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle time period change
  const handleTimePeriodChange = (period: 'all' | 'today' | '3days' | '7days' | '30days') => {
    setTimePeriod(period)
  }

  useEffect(() => {
    fetchJobLinks()
  }, [timePeriod])

  const handleApplyFilters = () => {
    fetchJobLinks()
  }

  const handleResetFilters = () => {
    setPlatform('all')
    setEmail('')
    setTotalLimit(100)
    setPerEmailLimit(5)
    setTimeout(() => {
      fetchJobLinks()
    }, 100)
  }

  // View application details
  const handleViewDetails = async (link: JobLink) => {
    setSelectedApplication(link)
    setDetailDialog(true)
    setDetailTab(0)
    setShowJsonView(false)
    
    try {
      setDetailLoading(true)
      const response = await analyticsAPI.getApplicationById(link._id)
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

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', backgroundColor: '#f5f5f5', width: '100%' }}>
      <Container maxWidth="xl" sx={{ py: 4, px: 3 }}>
        {/* Header with Time Period Selector */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
            Job Links by Platform
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

        {/* Filters */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Filters
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Platform</InputLabel>
              <Select
                value={platform}
                label="Platform"
                onChange={(e) => setPlatform(e.target.value)}
              >
                <MenuItem value="all">All Platforms</MenuItem>
                <MenuItem value="lever">Lever</MenuItem>
                <MenuItem value="rippling">Rippling</MenuItem>
                <MenuItem value="ashby">Ashby</MenuItem>
                <MenuItem value="greenhouse">Greenhouse</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Email Filter"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
            />

            <TextField
              label="Total Links Limit"
              type="number"
              value={totalLimit}
              onChange={(e) => setTotalLimit(Number(e.target.value))}
              size="small"
              sx={{ minWidth: 150 }}
              inputProps={{ min: 1, max: 1000 }}
            />

            <TextField
              label="Per Email Limit"
              type="number"
              value={perEmailLimit}
              onChange={(e) => setPerEmailLimit(Number(e.target.value))}
              size="small"
              sx={{ minWidth: 150 }}
              inputProps={{ min: 1, max: 20 }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
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
            <Button
              variant="outlined"
              onClick={fetchJobLinks}
              startIcon={<RefreshIcon />}
            >
              Refresh
            </Button>
          </Box>
        </Paper>

        {/* Stats */}
        {stats && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Links
                  </Typography>
                  <Typography variant="h5">
                    {stats.totalLinks}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Displayed Links
                  </Typography>
                  <Typography variant="h5">
                    {stats.displayedLinks}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Unique Emails
                  </Typography>
                  <Typography variant="h5">
                    {stats.uniqueEmails}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Platforms
                  </Typography>
                  <Typography variant="h5">
                    {Object.keys(stats.platformDistribution || {}).length}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Job Links Table */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Job Links ({jobLinks.length})
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Platform</TableCell>
                    <TableCell>Job Link</TableCell>
                    <TableCell>Total Fields</TableCell>
                    <TableCell>Filled Fields</TableCell>
                    <TableCell>Unfilled Fields</TableCell>
                    <TableCell>Completion Rate</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobLinks.map((link) => (
                    <TableRow key={link._id} hover sx={{ cursor: 'pointer' }}>
                      <TableCell onClick={() => handleViewDetails(link)}>{link.email}</TableCell>
                      <TableCell onClick={() => handleViewDetails(link)}>
                        <Chip label={link.platform} size="small" color="primary" variant="outlined" />
                      </TableCell>
                      <TableCell onClick={() => handleViewDetails(link)}>
                        <MuiLink
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                        >
                          {link.url}
                          <OpenInNewIcon fontSize="small" />
                        </MuiLink>
                      </TableCell>
                      <TableCell onClick={() => handleViewDetails(link)}>{link.analysis?.totalFields || 0}</TableCell>
                      <TableCell onClick={() => handleViewDetails(link)}>{link.analysis?.filledFields || 0}</TableCell>
                      <TableCell onClick={() => handleViewDetails(link)}>
                        <Typography
                          sx={{
                            color: link.analysis?.unfilledFields > 0 ? 'error.main' : 'text.primary',
                            fontWeight: link.analysis?.unfilledFields > 0 ? 'bold' : 'normal'
                          }}
                        >
                          {link.analysis?.unfilledFields || 0}
                        </Typography>
                      </TableCell>
                      <TableCell onClick={() => handleViewDetails(link)}>{link.completionRate.toFixed(1)}%</TableCell>
                      <TableCell onClick={() => handleViewDetails(link)}>
                        {new Date(link.timestamp).toLocaleDateString()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(link)}
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
          )}
        </Paper>
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

              {detailTab === 1 && (
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
                  ) : selectedApplication.analysis?.fields && selectedApplication.analysis.fields.length > 0 ? (
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
                  ) : (
                    <Alert severity="info">
                      Fields data is loading or not available. The full application data is being fetched.
                    </Alert>
                  )}
                </Box>
              )}

              {detailTab === 2 && (
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

              {detailTab === 3 && (
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

              {detailTab === 4 && (
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
    </Box>
  )
}

