import { useCallback, useState, useEffect } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  Paper,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Chip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Snackbar
} from '@mui/material';
import TableChartIcon from '@mui/icons-material/TableChart';
import CodeIcon from '@mui/icons-material/Code';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import StorageIcon from '@mui/icons-material/Storage';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { API_BASE_URL } from '../Subject/utils/utils.js';

export const STATE_REQUIREMENTS_PROMPT = `
Analyze the appraisal report for state-specific requirements based on the property's state.
Your output must be a single, clean JSON object. Do not include any text outside of the JSON object.
The JSON object must have a "summary" (a one to two-line overview of findings) and a "details" array.
Each object in the "details" array represents a requirement and must have the following keys:
- "requirement": A string describing the state-specific rule being checked.
- "status": A string, which must be one of 'Fulfilled', 'Not Fulfilled', or 'Not Applicable'.
- "value_or_comment": A string containing the extracted value or a brief comment explaining the status. If a value is extracted, also include the page number.

State-Specific Requirements:
- **Appraiser’s Fee Disclosure**: Required for AZ, CO, CT, GA, IL, LA, NJ, NV, NM, ND, OH, UT, VA, VT, WV.
- **AMC License # Inclusion**: Required for GA, IL, MT, NJ, OH, VT.
- **AMC License # and Expiration Date**: Required for IL (e.g., "558000312, Exp: 12/31/2026").
- **AMC Fee Inclusion**: Required for NV, NM, UT.
- **California (CA)**:
  - Comment on smoke/CO detectors.
  - Comment on double-strapped water heater.
  - For properties built after 2008, a specific CO detector comment is needed.
- **Illinois (IL)**:
  - AMC License # must be '558000312' with expiration '12/31/2026'.
  - Appraiser must disclose their fee.
  - Addendum must include the "Illinois Administrative Code 1455.245" statement.
  - Report must comment on Carbon Monoxide detector presence and include photos.
- **Utah (UT)**:
  - Comment on double-strapped water heaters.
  - AMC fee must be included.
  - Appraiser’s fee must be disclosed.
- **Virginia (VA)**: Confirm if smoke and CO detectors are installed.
- **Wisconsin (WI)**:
  - A copy of the invoice must be attached.
  - Confirm CO detector installation per Wis. Stat. Ann. § 101.647.
- **New York (NY)**: A copy of the invoice should be included (unless the client is Plaza Home Mortgage).
`;

const StateRequirementCheck = ({ onPromptSubmit, loading, response, error }) => {
  const [filterValue, setFilterValue] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'json'
  const [copied, setCopied] = useState(false);

  // MongoDB Guidelines Explorer State
  const [showMongoGuidelines, setShowMongoGuidelines] = useState(false);
  const [mongoGuidelines, setMongoGuidelines] = useState([]);
  const [mongoLoading, setMongoLoading] = useState(false);
  const [mongoError, setMongoError] = useState('');
  const [selectedState, setSelectedState] = useState('all');
  const [mongoSearch, setMongoSearch] = useState('');
  const [guidelineCopied, setGuidelineCopied] = useState(false);

  // Superuser & CRUD State
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [crudLoading, setCrudLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Dialog State: Add Guideline
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ state: '', remark: '' });

  // Dialog State: Edit Guideline
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({ id: '', state: '', remark: '' });

  // Dialog State: Delete Guideline
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Quick Superuser Authentication Unlock Modal
  const [openAuthDialog, setOpenAuthDialog] = useState(false);
  const [authInput, setAuthInput] = useState('admin');

  // Check superuser status on mount
  const checkAuthStatus = useCallback(async (manualUser = null) => {
    const user = manualUser || localStorage.getItem('username') || '';
    setCurrentUser(user);
    if (user === 'admin' || user === 'Abhi') {
      setIsSuperuser(true);
      return;
    }
    try {
      const token = localStorage.getItem('authToken');
      const headers = {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(user ? { 'X-Username': user } : {}),
      };
      const res = await fetch(`${API_BASE_URL}/api/guidelines/auth-status/`, { headers });
      const data = await res.json();
      if (data.is_superuser) {
        setIsSuperuser(true);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleManualAuthUnlock = async () => {
    const targetUser = authInput.trim();
    if (!targetUser) return;
    setCrudLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/guidelines/auth-status/`, {
        headers: { 'X-Username': targetUser },
      });
      const data = await res.json();
      if (data.is_superuser) {
        setIsSuperuser(true);
        setCurrentUser(targetUser);
        localStorage.setItem('username', targetUser);
        setSnackbar({ open: true, message: `Superuser privileges activated for '${targetUser}'.`, severity: 'success' });
        setOpenAuthDialog(false);
      } else {
        setSnackbar({ open: true, message: `'${targetUser}' does not have Superuser access. Use 'admin' or 'Abhi'.`, severity: 'error' });
      }
    } catch (e) {
      setSnackbar({ open: true, message: e.message || 'Auth check failed.', severity: 'error' });
    } finally {
      setCrudLoading(false);
    }
  };

  const fetchMongoGuidelines = async (forceRefresh = false) => {
    setMongoLoading(true);
    setMongoError('');
    try {
      const url = `${API_BASE_URL}/api/guidelines/state/${forceRefresh ? '?refresh=true' : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to fetch state guidelines: HTTP ${res.status}`);
      }
      setMongoGuidelines(data.data || []);
    } catch (e) {
      setMongoError(e.message || 'Could not load guidelines from MongoDB.');
    } finally {
      setMongoLoading(false);
    }
  };

  const toggleMongoGuidelines = () => {
    const nextState = !showMongoGuidelines;
    setShowMongoGuidelines(nextState);
    if (nextState) {
      if (mongoGuidelines.length === 0) {
        fetchMongoGuidelines();
      }
      let data = response;
      if (typeof response === 'string') {
        try { data = JSON.parse(response); } catch (e) {}
      }
      if (data && !data.state) {
        if (data.STATE_REQUIREMENT_CHECK) data = data.STATE_REQUIREMENT_CHECK;
      }
      if (data?.state && data.state !== 'GENERAL') {
        setSelectedState(data.state);
      }
    }
  };

  // CRUD Handlers
  const handleOpenAdd = () => {
    setAddForm({
      state: selectedState !== 'all' ? selectedState : '',
      remark: ''
    });
    setOpenAddDialog(true);
  };

  const handleAddSubmit = async () => {
    if (!addForm.state.trim() || !addForm.remark.trim()) {
      setSnackbar({ open: true, message: 'Please provide both State and Remark.', severity: 'warning' });
      return;
    }
    setCrudLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const username = currentUser || localStorage.getItem('username') || 'admin';
      const res = await fetch(`${API_BASE_URL}/api/guidelines/state/add/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'X-Username': username,
        },
        body: JSON.stringify({
          state: addForm.state.trim().toUpperCase(),
          remark: addForm.remark.trim(),
          admin_username: username,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || `Failed to add guideline: HTTP ${res.status}`);
      }
      setSnackbar({ open: true, message: `State requirement for '${addForm.state.toUpperCase()}' added successfully!`, severity: 'success' });
      setOpenAddDialog(false);
      setAddForm({ state: '', remark: '' });
      await fetchMongoGuidelines(true);
    } catch (e) {
      setSnackbar({ open: true, message: e.message || 'Error adding state guideline.', severity: 'error' });
    } finally {
      setCrudLoading(false);
    }
  };

  const handleOpenEdit = (item) => {
    setEditForm({
      id: item.id,
      state: item.state || item.state_raw || '',
      remark: item.remark || '',
    });
    setOpenEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!editForm.id || !editForm.state.trim() || !editForm.remark.trim()) {
      setSnackbar({ open: true, message: 'State and Remark cannot be empty.', severity: 'warning' });
      return;
    }
    setCrudLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const username = currentUser || localStorage.getItem('username') || 'admin';
      const res = await fetch(`${API_BASE_URL}/api/guidelines/state/update/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'X-Username': username,
        },
        body: JSON.stringify({
          id: editForm.id,
          state: editForm.state.trim().toUpperCase(),
          remark: editForm.remark.trim(),
          admin_username: username,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || `Failed to update guideline: HTTP ${res.status}`);
      }
      setSnackbar({ open: true, message: `State requirement for '${editForm.state.toUpperCase()}' updated successfully!`, severity: 'success' });
      setOpenEditDialog(false);
      await fetchMongoGuidelines(true);
    } catch (e) {
      setSnackbar({ open: true, message: e.message || 'Error updating state guideline.', severity: 'error' });
    } finally {
      setCrudLoading(false);
    }
  };

  const handleOpenDelete = (item) => {
    setItemToDelete(item);
    setOpenDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete || !itemToDelete.id) return;
    setCrudLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const username = currentUser || localStorage.getItem('username') || 'admin';
      const res = await fetch(`${API_BASE_URL}/api/guidelines/state/delete/${itemToDelete.id}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'X-Username': username,
        },
        body: JSON.stringify({
          id: itemToDelete.id,
          admin_username: username,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || `Failed to delete guideline: HTTP ${res.status}`);
      }
      setSnackbar({ open: true, message: 'State requirement deleted successfully!', severity: 'success' });
      setOpenDeleteDialog(false);
      setItemToDelete(null);
      await fetchMongoGuidelines(true);
    } catch (e) {
      setSnackbar({ open: true, message: e.message || 'Error deleting state guideline.', severity: 'error' });
    } finally {
      setCrudLoading(false);
    }
  };

  const handleCheckRequirements = () => {
    onPromptSubmit(STATE_REQUIREMENTS_PROMPT);
  };

  const renderResponse = useCallback(() => {
    if (!response) return null;

    let data = response;
    if (typeof response === 'string') {
      try {
        data = JSON.parse(response);
      } catch (e) {
        return <pre>{response}</pre>;
      }
    }

    if (data && !data.details) {
      if (data.STATE_REQUIREMENT_CHECK) data = data.STATE_REQUIREMENT_CHECK;
      else if (data.state_requirement_check) data = data.state_requirement_check;
      else if (data['State Requirement Check']) data = data['State Requirement Check'];
    }

    const { summary, details } = data || {};

    const greenStatuses = ['fulfilled', 'ok', 'pass', 'passed', 'yes'];
    const isGreen = (status) => {
      const normalized = String(status || '').trim().toLowerCase();
      return greenStatuses.includes(normalized);
    };

    const isRedOrReview = (status) => {
      const normalized = String(status || '').trim().toLowerCase();
      return ['not fulfilled', 'failed', 'needs review', 'review', 'no'].includes(normalized);
    };

    const getStatusStyle = (status) => {
      const normalizedStatus = String(status || '').trim().toLowerCase();
      const greenList = ['fulfilled', 'ok', 'yes', 'pass', 'passed'];
      const redList = ['not fulfilled', 'failed', 'no'];
      const yellowList = ['needs review', 'review'];
      const naList = ['not applicable', 'n/a', 'na'];

      if (greenList.includes(normalizedStatus)) {
        return {
          backgroundColor: '#d4edda',
          color: '#155724',
          border: '1px solid #c3e6cb',
          padding: '4px 8px',
          borderRadius: '4px',
          fontWeight: 'bold',
          display: 'inline-block'
        };
      } else if (redList.includes(normalizedStatus)) {
        return {
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          padding: '4px 8px',
          borderRadius: '4px',
          fontWeight: 'bold',
          display: 'inline-block'
        };
      } else if (yellowList.includes(normalizedStatus)) {
        return {
          backgroundColor: '#fff3cd',
          color: '#856404',
          border: '1px solid #ffeeba',
          padding: '4px 8px',
          borderRadius: '4px',
          fontWeight: 'bold',
          display: 'inline-block'
        };
      } else if (naList.includes(normalizedStatus)) {
        return {
          backgroundColor: '#e9ecef',
          color: '#495057',
          border: '1px solid #ced4da',
          padding: '4px 8px',
          borderRadius: '4px',
          fontWeight: 'bold',
          display: 'inline-block'
        };
      }
      return {
        padding: '4px 8px',
        borderRadius: '4px',
        display: 'inline-block'
      };
    };

    const parsedDetails = Array.isArray(details) ? details : [];

    const filteredDetails = parsedDetails.filter(item => {
      if (filterValue === 'passed') return isGreen(item.status);
      if (filterValue === 'failed') return isRedOrReview(item.status);
      return true;
    });

    const sortedDetails = [...filteredDetails].sort((a, b) => {
      const isGreenA = isGreen(a.status);
      const isGreenB = isGreen(b.status);
      if (isGreenA && !isGreenB) return -1;
      if (!isGreenA && isGreenB) return 1;
      return 0;
    });

    return (
      <Stack spacing={2} sx={{ mt: 3 }}>
        <Paper elevation={1} sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
            <Typography variant="h6" component="div" color="primary.main" display="flex" alignItems="center" gap={1}>
              {viewMode === 'table' ? <TableChartIcon fontSize="small" /> : <CodeIcon fontSize="small" />}
              {viewMode === 'table' ? 'State Requirements Breakdown' : 'State Requirements (Raw JSON)'}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              {viewMode === 'table' && (
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="state-status-filter-label">Filter Status</InputLabel>
                  <Select
                    labelId="state-status-filter-label"
                    id="state-status-filter"
                    value={filterValue}
                    label="Filter Status"
                    onChange={(e) => setFilterValue(e.target.value)}
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="passed">Passed / OK</MenuItem>
                    <MenuItem value="failed">Failed / Review</MenuItem>
                  </Select>
                </FormControl>
              )}

              <ButtonGroup size="small" variant="outlined">
                <Button
                  variant={viewMode === 'table' ? 'contained' : 'outlined'}
                  startIcon={<TableChartIcon fontSize="small" />}
                  onClick={() => setViewMode('table')}
                >
                  Table View
                </Button>
                <Button
                  variant={viewMode === 'json' ? 'contained' : 'outlined'}
                  startIcon={<CodeIcon fontSize="small" />}
                  onClick={() => setViewMode('json')}
                >
                  JSON View
                </Button>
              </ButtonGroup>

              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? 'Copied!' : 'Copy JSON'}
              </Button>

              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadIcon fontSize="small" />}
                onClick={() => {
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'state_requirements.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download JSON
              </Button>
            </Stack>
          </Stack>

          {viewMode === 'json' ? (
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2.5,
                borderRadius: 2,
                backgroundColor: '#0d1117',
                color: '#58a6ff',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                maxHeight: '480px',
                overflow: 'auto',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              <code>{JSON.stringify(data, null, 2)}</code>
            </Box>
          ) : (
            <>
              {summary && (
                <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default', borderRadius: 1.5, border: '1px solid #e0e0e0' }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom color="primary.main">
                    Summary
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {summary}
                  </Typography>
                </Paper>
              )}

              {details && Array.isArray(details) && (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Requirement</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Value / Comment</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedDetails.length > 0 ? (
                        sortedDetails.map((item, index) => {
                          const normalizedStatus = String(item.status || '').trim().toLowerCase();
                          const isInvalid = ['not fulfilled', 'failed', 'needs review', 'no'].includes(normalizedStatus);
                          const statusStyle = getStatusStyle(item.status);

                          let tooltipContent = '';
                          if (isInvalid) {
                            if (typeof item.value_or_comment === 'object' && item.value_or_comment !== null) {
                              tooltipContent = item.value_or_comment.value || JSON.stringify(item.value_or_comment);
                            } else {
                              tooltipContent = item.value_or_comment;
                            }
                          }
                          return (
                            <TableRow key={index}>
                              <TableCell>
                                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                  <span>{item.requirement}</span>
                                  {(item.is_mongo || (item.source && item.source.includes('MongoDB'))) && (
                                    <Chip
                                      size="small"
                                      label="MongoDB Verified"
                                      color="info"
                                      variant="outlined"
                                      sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, borderColor: '#90caf9', color: '#1565c0', bgcolor: '#f0f7ff' }}
                                    />
                                  )}
                                </Stack>
                              </TableCell>
                              <TableCell>
                                {isInvalid ? (
                                  <Tooltip title={tooltipContent} arrow>
                                    <span style={statusStyle}>{item.status}</span>
                                  </Tooltip>
                                ) : (
                                  <span style={statusStyle}>{item.status}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {typeof item.value_or_comment === 'object' && item.value_or_comment !== null ? (
                                  <>
                                    {item.value_or_comment.value && (
                                      <Typography variant="body2">{item.value_or_comment.value}</Typography>
                                    )}
                                    {item.value_or_comment.page_no && (
                                      <Typography variant="caption" color="text.secondary">
                                        Page: {item.value_or_comment.page_no}
                                      </Typography>
                                    )}
                                  </>
                                ) : (
                                  item.value_or_comment
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} align="center">
                            No matching items found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
          {data.mongo_guidelines && data.mongo_guidelines.length > 0 && (
            <Alert severity="info" sx={{ mt: 2 }} icon={<StorageIcon fontSize="inherit" />}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                Active MongoDB State Guidelines ({data.state || 'Subject State'}):
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, mt: 0.5 }}>
                {data.mongo_guidelines.map((g, idx) => (
                  <li key={idx}>
                    <Typography variant="body2">{g}</Typography>
                  </li>
                ))}
              </Box>
            </Alert>
          )}
        </Paper>
      </Stack>
    );
  }, [response, filterValue, viewMode, copied]);

  const uniqueStates = ['all', ...Array.from(new Set(mongoGuidelines.map(g => g.state))).filter(Boolean).sort()];

  const filteredMongoGuidelines = mongoGuidelines.filter(item => {
    if (selectedState !== 'all' && item.state !== selectedState) return false;
    if (mongoSearch.trim()) {
      const q = mongoSearch.toLowerCase();
      const matchState = (item.state || '').toLowerCase().includes(q) || (item.state_raw || '').toLowerCase().includes(q);
      const matchRemark = (item.remark || '').toLowerCase().includes(q);
      return matchState || matchRemark;
    }
    return true;
  });

  return (
    <div id="state-requirement-section" className="card shadow mb-4">
      <div className="card-header CAR1 bg-primary text-white d-flex justify-content-between align-items-center">
        <strong>State Requirement Check</strong>
        <Chip
          label="MongoDB Instruction.State_Requirements"
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 500 }}
        />
      </div>
      <div className="card-body">
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Button
              onClick={handleCheckRequirements}
              variant="contained"
              color="secondary"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Check State Requirements'}
            </Button>

            <Button
              onClick={toggleMongoGuidelines}
              variant={showMongoGuidelines ? "contained" : "outlined"}
              color="primary"
              startIcon={<StorageIcon />}
            >
              {showMongoGuidelines ? 'Hide MongoDB Guidelines' : 'View Guidelines from MongoDB'}
            </Button>
          </Stack>

          {/* MongoDB Guidelines Explorer Panel */}
          <Collapse in={showMongoGuidelines}>
            <Paper elevation={2} sx={{ p: 2.5, mt: 1, border: '1px solid #90caf9', bgcolor: '#fbfdff' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <StorageIcon color="primary" fontSize="small" />
                    MongoDB State Requirements (Live Database)
                  </Typography>
                  {isSuperuser ? (
                    <Chip
                      icon={<AdminPanelSettingsIcon />}
                      label={`Superuser: ${currentUser || 'admin'}`}
                      color="success"
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  ) : (
                    <Tooltip title="Click to unlock Superuser CRUD privileges">
                      <Chip
                        icon={<AdminPanelSettingsIcon />}
                        label="Admin Login"
                        size="small"
                        variant="outlined"
                        clickable
                        onClick={() => setOpenAuthDialog(true)}
                      />
                    </Tooltip>
                  )}
                </Box>

                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    startIcon={<RefreshIcon />}
                    onClick={handleCheckRequirements}
                    disabled={loading}
                  >
                    Cross-Verify Document with MongoDB Guidelines
                  </Button>
                  {isSuperuser && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<AddIcon />}
                      onClick={handleOpenAdd}
                    >
                      Add Guideline
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => fetchMongoGuidelines(true)}
                    disabled={mongoLoading}
                  >
                    Refresh
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => {
                      navigator.clipboard.writeText(STATE_REQUIREMENTS_PROMPT);
                      setGuidelineCopied(true);
                      setTimeout(() => setGuidelineCopied(false), 2000);
                    }}
                  >
                    {guidelineCopied ? 'Copied Prompt!' : 'Copy Prompt'}
                  </Button>
                </Stack>
              </Stack>

              {mongoLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" py={4} gap={1.5}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary">Loading guidelines from MongoDB cluster...</Typography>
                </Box>
              ) : mongoError ? (
                <Alert severity="error">{mongoError}</Alert>
              ) : (
                <>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel id="mongo-state-select-label">Select State</InputLabel>
                      <Select
                        labelId="mongo-state-select-label"
                        id="mongo-state-select"
                        value={selectedState}
                        label="Select State"
                        onChange={(e) => setSelectedState(e.target.value)}
                      >
                        {uniqueStates.map(st => (
                          <MenuItem key={st} value={st}>
                            {st === 'all' ? 'All States' : st}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      size="small"
                      placeholder="Search guideline text or state..."
                      value={mongoSearch}
                      onChange={(e) => setMongoSearch(e.target.value)}
                      fullWidth
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Showing {filteredMongoGuidelines.length} of {mongoGuidelines.length} guidelines
                  </Typography>

                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 380 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f0f4f8' }}>
                          <TableCell sx={{ fontWeight: 'bold', width: '90px' }}>State</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Guideline / Remark (from MongoDB)</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', width: '60px', textAlign: 'center' }}>Copy</TableCell>
                          {isSuperuser && (
                            <TableCell sx={{ fontWeight: 'bold', width: '100px', textAlign: 'center' }}>Actions</TableCell>
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredMongoGuidelines.length > 0 ? (
                          filteredMongoGuidelines.map((item, idx) => (
                            <TableRow key={item.id || idx} hover>
                              <TableCell>
                                <Chip
                                  label={item.state}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ fontWeight: 'bold' }}
                                />
                                {item.state_raw && item.state_raw !== item.state && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {item.state_raw}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'pre-wrap' }}>
                                <Typography variant="body2">{item.remark}</Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip title="Copy Guideline">
                                  <IconButton
                                    size="small"
                                    onClick={() => navigator.clipboard.writeText(item.remark)}
                                  >
                                    <ContentCopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                              {isSuperuser && (
                                <TableCell align="center">
                                  <Stack direction="row" spacing={0.5} justifyContent="center">
                                    <Tooltip title="Edit Guideline">
                                      <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={() => handleOpenEdit(item)}
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete Guideline">
                                      <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => handleOpenDelete(item)}
                                      >
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </Stack>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={isSuperuser ? 4 : 3} align="center">
                              No guidelines match the selected state or search.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Paper>
          </Collapse>

          {/* Add State Guideline Dialog */}
          <Dialog open={openAddDialog} onClose={() => !crudLoading && setOpenAddDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <AddIcon color="success" /> Add State Guideline (MongoDB)
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  This will insert a new rule directly into <strong>Instruction.State_Requirements</strong> in MongoDB Atlas.
                </Typography>
                <TextField
                  label="State (2-Letter Code or Name, e.g. CA, TX, IL)"
                  fullWidth
                  size="small"
                  value={addForm.state}
                  onChange={(e) => setAddForm(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                  placeholder="e.g. CA"
                  required
                />
                <TextField
                  label="Requirement / Guideline Remark"
                  fullWidth
                  multiline
                  rows={4}
                  value={addForm.remark}
                  onChange={(e) => setAddForm(prev => ({ ...prev, remark: e.target.value }))}
                  placeholder="Enter the specific state requirement or rule..."
                  required
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setOpenAddDialog(false)} disabled={crudLoading}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleAddSubmit}
                disabled={crudLoading || !addForm.state.trim() || !addForm.remark.trim()}
                startIcon={crudLoading ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
              >
                {crudLoading ? 'Adding...' : 'Add Guideline'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Edit State Guideline Dialog */}
          <Dialog open={openEditDialog} onClose={() => !crudLoading && setOpenEditDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <EditIcon color="primary" /> Edit State Guideline (MongoDB)
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label="State Code"
                  fullWidth
                  size="small"
                  value={editForm.state}
                  onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                  required
                />
                <TextField
                  label="Requirement / Guideline Remark"
                  fullWidth
                  multiline
                  rows={4}
                  value={editForm.remark}
                  onChange={(e) => setEditForm(prev => ({ ...prev, remark: e.target.value }))}
                  required
                />
                <Typography variant="caption" color="text.secondary">
                  Document ObjectId: {editForm.id}
                </Typography>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setOpenEditDialog(false)} disabled={crudLoading}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleEditSubmit}
                disabled={crudLoading || !editForm.state.trim() || !editForm.remark.trim()}
                startIcon={crudLoading ? <CircularProgress size={18} color="inherit" /> : <EditIcon />}
              >
                {crudLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete State Guideline Confirmation Dialog */}
          <Dialog open={openDeleteDialog} onClose={() => !crudLoading && setOpenDeleteDialog(false)} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
              <DeleteOutlineIcon color="error" /> Confirm Delete
            </DialogTitle>
            <DialogContent>
              <DialogContentText>
                Are you sure you want to permanently delete this guideline for state <strong>{itemToDelete?.state}</strong> from MongoDB?
              </DialogContentText>
              {itemToDelete?.remark && (
                <Paper variant="outlined" sx={{ p: 1.5, mt: 2, bgcolor: '#fff5f5' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxHeight: 80, overflowY: 'auto' }}>
                    "{itemToDelete.remark}"
                  </Typography>
                </Paper>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 2.5, py: 1.5 }}>
              <Button onClick={() => setOpenDeleteDialog(false)} disabled={crudLoading}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleDeleteConfirm}
                disabled={crudLoading}
                startIcon={crudLoading ? <CircularProgress size={18} color="inherit" /> : <DeleteOutlineIcon />}
              >
                {crudLoading ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Quick Superuser Admin Unlock Dialog */}
          <Dialog open={openAuthDialog} onClose={() => !crudLoading && setOpenAuthDialog(false)} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <AdminPanelSettingsIcon color="primary" /> Superuser Admin Access
            </DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ mb: 2 }}>
                Enter an authorized Superuser username (e.g. <code>admin</code> or <code>Abhi</code>) to unlock live MongoDB add, edit, and delete controls.
              </DialogContentText>
              <TextField
                autoFocus
                label="Superuser Username"
                fullWidth
                size="small"
                value={authInput}
                onChange={(e) => setAuthInput(e.target.value)}
                placeholder="admin"
              />
            </DialogContent>
            <DialogActions sx={{ px: 2.5, py: 1.5 }}>
              <Button onClick={() => setOpenAuthDialog(false)} disabled={crudLoading}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleManualAuthUnlock}
                disabled={crudLoading || !authInput.trim()}
              >
                {crudLoading ? 'Checking...' : 'Activate Admin'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Feedback Snackbar */}
          <Snackbar
            open={snackbar.open}
            autoHideDuration={4000}
            onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            <Alert
              onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
              severity={snackbar.severity}
              variant="filled"
              sx={{ width: '100%' }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>

          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {response && renderResponse()}
        </Stack>
      </div>
    </div>
  );
};

export default StateRequirementCheck;
