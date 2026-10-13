import React, { useCallback, useState, useEffect } from 'react';
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
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

export const CLIENT_REQUIREMENT_PROMPT = `
Client Requirement Check:
Based on the Lender/Client name in the document, verify if it matches any of a list of lenders/clients and check for any specific requirements.
Your output must be a single, clean JSON object. Do not include any text outside of the JSON object.
The JSON object must have a "summary" (a one to two-line overview stating which lender/client is present and if their requirements are met) and a "details" array.
Each object in the "details" array represents a requirement and must have the following keys:
- "requirement": A string describing the client-specific rule being checked.
- "status": A string, which must be one of 'Fulfilled', 'Not Fulfilled', 'Needs Review', or 'Not Applicable'.
- "value_or_comment": A string containing the extracted value or a brief comment explaining the status. If a value is extracted, also include the page number.

Lender/Client List and their requirements:
- Visio Lending:
  - Report Condition: Verify the report is made "As Is". If not, status is "Needs Review" with comment: "Report is not 'As Is', please advise before rejecting."
  - No Repairs: Even if the report is "As Is", verify there are no repairs listed. If repairs are found, status is "Needs Review" with comment: "This is Visio. Report made as-is and the subject has repair, please refer the snap and advise."
  - Reviewer Notes: No need to check for specific neighborhood words (Average, convenient, good, desirable). UAD pages are not mandatory.

- Best2Lend LLC:
  - Two-Value Report Requirements: For reports with two values ("As-Is" and "As-Repaired"), the "As-Is" comps are not required to be gridded.
- Ice Lender Holdings LLC:
  - "As Is" Report: Verify the appraisal is made "as is". If not, the status should be "Not Fulfilled" with a comment to advise before rejecting.
  - Value vs. Price: Check if the final appraised value is more than 10% higher than the listing price (from 'Offered for Sale in Last 12 Months' field) or purchase/contract price. If so, status is "Needs Review" and comment should be "Please address the appraised value being higher than the purchase price for the subject property."
  - USPAP Compliance Addendum: Verify that a "USPAP Compliance Addendum" page or section is included in the report. If not found, status is "Not Fulfilled" with comment "Per client instructions: All appraisal reports must include the updated USPAP compliance addendum."
  - FIRREA Statement: Verify the report contains a statement that it was prepared in accordance with FIRREA (Financial Institutions Reform, Recovery, and Enforcement Act of 1989) requirements. If not found, status is "Not Fulfilled" with comment "Per client instructions: All appraisal reports must contain commentary indicating that the report was prepared in accordance with FIRREA requirements".
  - Photographs: Based on photo labels or descriptions, verify that photos of the interior, exterior, all mechanical systems, full kitchen (including refrigerator, stove, oven, sink), and the roof are present.
  - Kitchen Photo with Refrigerator: Specifically confirm the kitchen photo shows a refrigerator. If not, status is "Not Fulfilled" with comment "Per client instructions, please provide a kitchen photo with the refrigerator showing. If there is no refrigerator in the kitchen, please address as comments in the report."
  - Comparable Distance Guidelines: Based on the neighborhood location type (Urban, Suburban, or Rural), check the 'Proximity to Subject' for each comparable sale against these guidelines: Urban <= 1 mile, Suburban <= 3 miles, Rural <= 10 miles. If any comparable exceeds the guideline, its status is "Not Fulfilled" with the comment "Comp #X exceeds the client's distance guideline of Y mile(s). Please address the need to use this comp."
- Equity Wave Lending, Inc:
  - Intended Use/User Verbiage: Verify the report contains the specific "Intended User" and "Intended Use" statements.
    - Intended User: "Equity Wave Lending, Inc. it's investors, assignees, and/or successors"
    - Intended Use: "The making, arranging, or selling of a private money/hard money loan"
    - If either is missing, status is "Not Fulfilled" with comment: "Please include the required Intended Use/User verbiage."
- Hometown equity:
  - Smoke/CO Detectors: Please confirm if smoke/co detectors are installed and ask for photos.
- FOUNDATION MORTGAGE:
  - Short Term Rental (STR) Form: If the product type includes "STR 1007", verify that the specific STR form is used, not a standard 1007 form.
- BPL Mortgage, LLC:
  - Smoke/CO Detectors: Verify the report addresses if smoke/CO detectors were present and if they are required by law. If not mentioned, status is "Not Fulfilled" with comment: "Please address if smoke/co detector were present and required by law".
  - Value vs. Price: Check if the final appraised value is more than 10% higher than the listing price or purchase/contract price. If it is, verify an explanatory comment exists. If no comment, status is "Needs Review" with comment: "Please address the appraised value being higher than the purchase price for the subject property." For "As-is w/ARV" reports, compare against the "as-is" value.
  - Value Increase Since Prior Sale: If the final value is higher than the subject's prior sale price, verify that there are comments in the 'Improvements' or 'Prior Sales History' sections explaining the value increase. If no explanation is found, status is "Needs Review" with comment: "Please address the increase in value since the subject's prior sale".
  - Cost to Cure: Check for any mentioned repairs or deferred maintenance. If found, verify a "cost to cure" is provided. If required but missing, status is "Not Fulfilled" with comment: "Please provide cost to cure for the repairs/deferred maintenance.". Exceptions: No cost to cure is needed if the only repair is turning on water, or on a 1004D form.
  - Cost Approach Completion: Verify that the "Cost Approach" section is completed. If not, status is "Not Fulfilled" with comment: "Per engagement letter, please complete the cost approach even if it is not weighted or applied in determining the value of the subject."
  - Photo Requirements: Verify there are at least 2 photos for every room, taken from opposite sides, and that they are not blurry, pixelated, or dark.
  - Bedroom Photo Labels: Ensure bedroom photos are labeled specifically as "Bedroom 1", "Bedroom 2", etc. If not, status is "Not Fulfilled" with comment: "The bedroom photos need to be labeled as 'Bedroom 1', 'Bedroom 2' etc., please revise the label of bedroom photos accordingly."
  - Distance Guidelines: Check comparable distances against these guidelines: Urban <= 1 mile, Suburban <= 1 mile, Rural <= 5 miles. If a comp exceeds its guideline, verify a comment explains the reason. If no comment, status is "Not Fulfilled" with comment: "Please address the use of comp #X exceeding lender distance guideline of Y mile(s)."
  - Multi-family Unit Count: For multi-family properties, verify that the number of units in the subject property matches the number of units for all comparable properties. If there is a mismatch, status is "Not Fulfilled" with comment: "The subject is a X-unit property; however, Comp #Y used is a Z-unit property. please address as a comment in the report."
  - Heating System: Verify the report addresses if the subject's heating system is functional. A comment from the appraiser that it was too hot to test is an acceptable reason. If not addressed, status is "Not Fulfilled" with comment: "Please address if the subject's heating system is functioning".
  - Quality and Condition Ratings: Verify that all reports (including 1025 and 2090) use "Q" and "C" ratings for "Quality" and "Condition" for the subject and all comparables. If not, status is "Not Fulfilled" with comment: "Per client requirement, please include 'Q' and 'C' ratings for 'Quality' and 'Condition' for the subject and all comps."
  - Unacceptable Practices: No need to review for FREDDIE unacceptable practices.
  - 1004MC Form: The 1004MC form is not required.
- Rain City Capital:
  - Report Type: Client requires conventional reports.
  - Health and Safety: Any identified health and safety issues must make the report "subject to" that condition.
  - Two-Value Reports: Must be completed "Subject to," and include an additional grid for the "As Is" value.
  - Cost to Cure: Verify that no "cost to cure" is provided for cosmetic items. If a cost to cure for cosmetic items is found, status is "Not Fulfilled" with comment: "Please remove cost to cure for cosmetic items."
  - 1004MC Form: The 1004MC form is not required.
  - Payment Status: Verify the order is marked as PAID.
- TheLender:
  - Smoke/CO Detectors: Ensure photos of smoke and CO detectors are included if they are present and required to be installed. If not, status is "Not Fulfilled" with comment: "Please confirm if smoke/CO detectors are present/required and include photos."

- East Coast Capital Corp:
  - Cost Approach Completion: Verify that the cost approach is completed. If not, status is "Not Fulfilled" with comment: "This client requires the cost approach to be completed, even if it is not relevant to the development of value."
- Plaza home mortage:
  - Invoice (NY State Only): If the property state is NY, verify that an invoice is NOT included in the report. If an invoice is found, the status is "Needs Review" with the comment: "Can the appraiser please remove the invoice from the report? This will be delivered to the client as a separate document. Please also ask the appraiser to upload the invoice to the Supporting Documents section."
  - Client Email Address: Verify that the client's email address is present in the report. If it is missing, the status is "Needs Review" with the comment: "The report can be completed, but advise the team that we could not email the report to the client because there is no email address."
  - Invoice Upload (Non-NY): For states other than NY, if an invoice is required but not found in the report, the status is "Needs Review" with the comment: "Complete the order and advise the team that the appraiser needs to upload the invoice to the supporting documents."
- Lend with Aloha LLC ISAOA/ATIMA_x000a_Malama Funding LLC ISAOA/ATIMA
- CIVIC:
  - As-Is Value Order: For reports with two values (e.g., "As-Is" and "As-Repaired"), verify that the "As-Is" value is presented first.
  - Unacceptable Practices: No need to review for FREDDIE Unacceptable Practices.
- National Loan Funding LLC/ Easy Street Capital, LLC:
  - Prior Services: Check the prior services statement. If the appraiser indicates they 'did' or 'have' performed services on the subject property within the last 3 years, the status should be "Needs Review" with the comment: "The appraiser performed prior service on subject property within the three-year period, please refer the snap and advise".
- Capital Funding Financial:
  - As-Is Value First: On any 2-value reports (e.g., "As-Is" and "As-Repaired"), verify that the "As-Is" value is presented first in the reconciliation section. If the report is completed for the "As-Repaired Value" first, the status should be "Not Fulfilled" with the comment: "The client requires the report to be completed for the As-Is value. Please update the report to show the As-Is value in the Reconciliation section, with the As-Is comps included in the grid as comps #1-#3."
- Sierra Pacific Mortgage Company
  - 1004MC must needed
- Temple View:
  - Two-Value Report Requirements: For reports with two values ("As-Is" and "As-Repaired"):
    1. Report Condition: Verify the report is completed "subject to" the hypothetical condition that repairs have been completed.
    2. ARV Comps: Confirm at least 3 "As-Repaired Value" (ARV) comps are gridded in the sales comparison approach.
    3. As-Is Comps: Verify that 3 "As-Is" comps are referenced. They are not required to be gridded, but if they are not, there must be comments identifying the 3 comps used and explaining how the "As-Is" value was reconciled. If the appraiser chooses to grid them, that is also acceptable.
    4. Value Basis: The final value should be subject to the repair bid.
- Kind Lending:
  - ENV File: An ENV file is not required. XML and PDF files are sufficient.
  - 1004MC Form: The 1004MC form is not required.
- Loandepot:
  - 1004MC Form: The 1004MC form is a mandatory client requirement. Verify its presence and completion. If the appraiser has commented that it is not needed, this is incorrect and should be flagged. Status should be "Not Fulfilled" if missing or commented as not needed.
  - General Instructions: For any required revisions, do not mention page numbers in the comments, especially for ENV files. Revisions should be posted on the internal group for review before sending to the appraiser.

- Dart Bank:
  - ENV File: An ENV file is required for now.
  - Payment Status: Verify the order is marked as PAID.
- The Loan Store:
  - 1004MC Form: Verify the 1004MC form is included and completed.
  - Double-Strapped Water Heaters (UT Only): If the property state is UT, verify the report includes a comment on whether the water heater is double-strapped.
  - Environmental Addendum (Commercial Only): For commercial reports, verify that an "Environmental Addendum" or "Form 69F2" is included. If not, status is "Not Fulfilled" with comment: "The client requires Environmental Addendum Form 69F2 to be included in all commercial appraisals. Please include."
  - General Instructions:
    - For 1007 Rent Schedule reports, an ENV file is not required; a PDF is acceptable.
    - An ENV file is not generally required for this client.
    - When creating revisions, do not mention page numbers, especially for ENV files.
- Champions funding:
  - E&O Insurance: Verify that the appraiser's E&O (Errors and Omissions) insurance document is attached to the report. If not attached, status is "Not Fulfilled" with comment: "Per client instructions for their assignments, please attach appraiser's E&O to the report."
  - Value vs. Predominant Value: Check if the appraised value is more than 10% higher or lower than the 'predominant value' from the neighborhood section. If it is, and no explanatory comment exists, the status is "Not Fulfilled".
    - If value is lower, comment: "Appraised value is lower than Predominant value. Appraiser to comment whether it is an under improvement and if there is any impact on the value and marketability of the subject property".
    - If value is higher, comment: "Appraised value is higher than Predominant value. Appraiser to comment whether it is an over improvement and if there is any impact on the value and marketability of the subject property."
- GFL Capital Mortgage:
  - Value vs. Purchase Price: If the final appraised value is lower than the purchase price, the status should be "Needs Review" with the comment: "Final value is lower than purchase price, please advise".
 
- Futures Financial:
  - Reviewer Level: Only senior members should review these reports.
  - Borrower "FRANCIS, Richel":
    - If product type is "Desktop", verify the report is a desktop ARV and the reconciliation section is "subject-to plans and specs".
    - If product type is "As-is with ARV", verify the report is "as-is" and includes two values.
- Cardinal financial company:
  - No 1004MC is OK
- Deephaven Mortgage LLC:
  - Built-Up Status: If "Built Up" in the neighborhood section is "Over 75%", the status should be "Needs Review" with the comment: "Please confirm if 75% built-up status impacts marketability of the subject property."
- OCMBC:
  - Smoke/CO Detectors: Verify the report comments on whether smoke/CO detectors were present. If not mentioned, status is "Not Fulfilled" with comment: "Please comment if smoke/CO detectors were or were not present."
  - Water Heater Strapping: Verify the report comments on whether the hot water heater is properly double strapped and if this is required by law. If not mentioned, status is "Not Fulfilled" with comment: "Please comment if the hot water heater is properly double strapped and if these are required by law."
- Loanguys.com inc:
  - Quality and Condition Ratings: Verify that all reports (including 1025 and 2090) use "Q" and "C" ratings for "Quality" and "Condition" for the subject and all comparables. If not, status is "Not Fulfilled" with comment: "Per client requirement, please include 'Q' and 'C' ratings for 'Quality' and 'Condition' for the subject and all comps."
- Paramount Residential Mortgage Group:
  - Lender Name Formatting: Verify if the lender name "Paramount Residential Mortgage Group" includes "INC". If it does, the status should be "Needs Review" with the comment: "Lender name includes 'INC'. Per client, if this is the only revision needed, it can be disregarded and the report submitted."
- Arc Home:
  - Short Term Rental (STR) Requirements: If the product type is "Short term rental" or "STR", verify the appraiser has addressed local short-term rental regulations (zoning allowances, licensing). If not addressed, status is "Needs Review" with comment: "This is an STR order, please escalate for review. Appraiser must address short term rental regulations, such as whether the local jurisdiction allows short term rentals per the zoning requirements or if they require the owners to obtain a license."
- CV3 Financial:
  - Borrower Name: Verify that the 'Borrower' field contains the entity name (e.g., an LLC) and that a comment in an addendum mentions the individual borrower's name. If the borrower is an entity and the individual's name is not commented, the status is "Not Fulfilled" with a comment like "Please comment that the individual borrower is [Individual's Name]."
  - Unacceptable Practices: No need to review for FREDDIE Unacceptable Practices.
- Nationwide Mortgage Bankers:
  - Hurricane Damage Statement (FL): If the property state is Florida (FL), verify the report addresses any potential damage from "Hurricane Helene" and "Hurricane Milton". If not addressed, status is "Not Fulfilled" with comment: "Please address if the subject has suffered any damage from the recent hurricanes Helene and Milton."
  - Hurricane Damage Statement (GA, NC, SC, TN, VA): If the property state is Georgia (GA), North Carolina (NC), South Carolina (SC), Tennessee (TN), or Virginia (VA), verify the report addresses any potential damage from "Hurricane Helene". If not addressed, status is "Not Fulfilled" with comment: "Please address if the subject has suffered any damage from the recent hurricane Helene."
- Logan Financial / Logan Finance:
  - Smoke/CO Detectors: Verify the report includes commentary on the presence of smoke/CO detectors and includes photos. If not, status is "Not Fulfilled" with comment: "Please confirm if smoke/CO detectors are present/required and include photos."

- New American Funding:
  - Health and Safety Repairs: Verify that any identified health and safety issues (including required smoke/CO detectors and water heater straps) are made "subject to repair". If not, status is "Not Fulfilled".
  - 1004MC Form: The 1004MC form is not required.
  - ROV Review (C2C/Fastapp orders): For "Coast to Coast" or "Fastapp" orders, if the report is a revision from an ROV, it should be reviewed and then escalated for completion approval. Status should be "Needs Review" with comment: "ROV is good to go. Escalate to team before completing."
- Haus Capital:
  - Report Condition: If the appraisal is made "Subject To", the status should be "Needs Review" with the comment: "Report is 'Subject To'. Please advise."

`;

const ClientRequirementCheck = ({ onPromptSubmit, loading, response, error }) => {
  const [filterValue, setFilterValue] = useState('all');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'json'
  const [copied, setCopied] = useState(false);

  // MongoDB Client Guidelines Explorer State
  const [showMongoGuidelines, setShowMongoGuidelines] = useState(false);
  const [mongoClients, setMongoClients] = useState([]);
  const [mongoCommon, setMongoCommon] = useState([]);
  const [mongoLoading, setMongoLoading] = useState(false);
  const [mongoError, setMongoError] = useState('');
  const [selectedClient, setSelectedClient] = useState('all');
  const [clientSearch, setClientSearch] = useState('');
  const [guidelineCopied, setGuidelineCopied] = useState(false);

  // Superuser & CRUD State
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [crudLoading, setCrudLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Dialog State: Add Lender Guideline
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    client: '',
    customClient: '',
    remark: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Dialog State: Edit Lender Guideline
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    client: '',
    collection: '',
    remark: '',
    date: ''
  });

  // Dialog State: Delete Lender Guideline
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

  const fetchMongoClients = async (forceRefresh = false) => {
    setMongoLoading(true);
    setMongoError('');
    try {
      const url = `${API_BASE_URL}/api/guidelines/client/${forceRefresh ? '?refresh=true' : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to fetch client guidelines: HTTP ${res.status}`);
      }
      setMongoClients(data.data?.clients || []);
      setMongoCommon(data.data?.common || []);
    } catch (e) {
      setMongoError(e.message || 'Could not load client guidelines from MongoDB.');
    } finally {
      setMongoLoading(false);
    }
  };

  const toggleMongoGuidelines = () => {
    const nextState = !showMongoGuidelines;
    setShowMongoGuidelines(nextState);
    if (nextState) {
      if (mongoClients.length === 0) {
        fetchMongoClients();
      }
      let data = response;
      if (typeof response === 'string') {
        try { data = JSON.parse(response); } catch (e) {}
      }
      if (data && !data.lender) {
        if (data.CLIENT_REQUIREMENT_CHECK) data = data.CLIENT_REQUIREMENT_CHECK;
      }
      if (data?.lender && data.lender !== 'General / Unspecified') {
        setSelectedClient(data.lender);
      }
    }
  };

  // CRUD Handlers
  const handleOpenAdd = () => {
    const defaultClient = selectedClient !== 'all' ? selectedClient : (mongoClients[0]?.display_name || 'Visio Lending');
    setAddForm({
      client: defaultClient,
      customClient: '',
      remark: '',
      date: new Date().toISOString().split('T')[0]
    });
    setOpenAddDialog(true);
  };

  const handleAddSubmit = async () => {
    const targetClient = addForm.client === '__new__' ? addForm.customClient.trim() : addForm.client;
    if (!targetClient || !addForm.remark.trim()) {
      setSnackbar({ open: true, message: 'Please provide both Lender name and Guideline remark.', severity: 'warning' });
      return;
    }
    setCrudLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const username = currentUser || localStorage.getItem('username') || 'admin';
      const res = await fetch(`${API_BASE_URL}/api/guidelines/client/add/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'X-Username': username,
        },
        body: JSON.stringify({
          client: targetClient,
          remark: addForm.remark.trim(),
          date: addForm.date || new Date().toISOString().split('T')[0],
          admin_username: username,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || `Failed to add client guideline: HTTP ${res.status}`);
      }
      setSnackbar({ open: true, message: `Lender requirement for '${data.data?.display_name || targetClient}' added successfully!`, severity: 'success' });
      setOpenAddDialog(false);
      setAddForm({ client: '', customClient: '', remark: '', date: '' });
      await fetchMongoClients(true);
    } catch (e) {
      setSnackbar({ open: true, message: e.message || 'Error adding lender guideline.', severity: 'error' });
    } finally {
      setCrudLoading(false);
    }
  };

  const handleOpenEdit = (item) => {
    setEditForm({
      id: item.id,
      client: item.client || item.collection,
      collection: item.collection,
      remark: item.remark || '',
      date: item.date ? String(item.date).split('T')[0] : new Date().toISOString().split('T')[0]
    });
    setOpenEditDialog(true);
  };

  const handleEditSubmit = async () => {
    if (!editForm.id || !editForm.collection || !editForm.remark.trim()) {
      setSnackbar({ open: true, message: 'Guideline remark cannot be empty.', severity: 'warning' });
      return;
    }
    setCrudLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const username = currentUser || localStorage.getItem('username') || 'admin';
      const res = await fetch(`${API_BASE_URL}/api/guidelines/client/update/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'X-Username': username,
        },
        body: JSON.stringify({
          collection: editForm.collection,
          id: editForm.id,
          remark: editForm.remark.trim(),
          date: editForm.date,
          admin_username: username,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || `Failed to update client guideline: HTTP ${res.status}`);
      }
      setSnackbar({ open: true, message: `Lender guideline for '${editForm.client}' updated successfully!`, severity: 'success' });
      setOpenEditDialog(false);
      await fetchMongoClients(true);
    } catch (e) {
      setSnackbar({ open: true, message: e.message || 'Error updating lender guideline.', severity: 'error' });
    } finally {
      setCrudLoading(false);
    }
  };

  const handleOpenDelete = (item) => {
    setItemToDelete(item);
    setOpenDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete || !itemToDelete.id || !itemToDelete.collection) return;
    setCrudLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const username = currentUser || localStorage.getItem('username') || 'admin';
      const url = `${API_BASE_URL}/api/guidelines/client/delete/?collection=${encodeURIComponent(itemToDelete.collection)}&id=${encodeURIComponent(itemToDelete.id)}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'X-Username': username,
        },
        body: JSON.stringify({
          collection: itemToDelete.collection,
          id: itemToDelete.id,
          admin_username: username,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status === 'error') {
        throw new Error(data.message || `Failed to delete client guideline: HTTP ${res.status}`);
      }
      setSnackbar({ open: true, message: 'Lender guideline deleted successfully!', severity: 'success' });
      setOpenDeleteDialog(false);
      setItemToDelete(null);
      await fetchMongoClients(true);
    } catch (e) {
      setSnackbar({ open: true, message: e.message || 'Error deleting lender guideline.', severity: 'error' });
    } finally {
      setCrudLoading(false);
    }
  };

  const handleCheck = () => {
    onPromptSubmit(CLIENT_REQUIREMENT_PROMPT);
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
      if (data.CLIENT_REQUIREMENT_CHECK) data = data.CLIENT_REQUIREMENT_CHECK;
      else if (data.client_requirement_check) data = data.client_requirement_check;
      else if (data['Client Requirement Check']) data = data['Client Requirement Check'];
    }

    const summary = data?.summary ?? 'No summary available';
    const details = Array.isArray(data?.details) ? data.details : [];

    const renderValue = (val) => {
      if (val == null) return '';  
      if (typeof val === 'object') return JSON.stringify(val, null, 2);
      return String(val);
    };

    const getStatusStyle = (status) => {
      const normalizedStatus = String(status || '').trim().toLowerCase();
      
      const greenStatuses = ['fulfilled', 'ok', 'yes', 'pass', 'passed'];
      const yellowStatuses = ['needs review', 'review'];
      const redStatuses = ['not fulfilled', 'failed', 'no'];
      const naStatuses = ['not applicable', 'n/a', 'na'];
      
      if (greenStatuses.includes(normalizedStatus)) {
        return {
          backgroundColor: '#d4edda',
          color: '#155724',
          border: '1px solid #c3e6cb',
          padding: '4px 8px',
          borderRadius: '4px',
          fontWeight: 'bold',
          display: 'inline-block'
        };
      } else if (yellowStatuses.includes(normalizedStatus)) {
        return {
          backgroundColor: '#fff3cd',
          color: '#856404',
          border: '1px solid #ffeeba',
          padding: '4px 8px',
          borderRadius: '4px',
          fontWeight: 'bold',
          display: 'inline-block'
        };
      } else if (redStatuses.includes(normalizedStatus)) {
        return {
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          padding: '4px 8px',
          borderRadius: '4px',
          fontWeight: 'bold',
          display: 'inline-block'
        };
      } else if (naStatuses.includes(normalizedStatus)) {
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

    const isGreen = (status) => {
      const normalized = String(status || '').trim().toLowerCase();
      return ['fulfilled', 'ok', 'pass', 'passed', 'yes'].includes(normalized);
    };

    const isRedOrReview = (status) => {
      const normalized = String(status || '').trim().toLowerCase();
      return ['not fulfilled', 'failed', 'needs review', 'review', 'no'].includes(normalized);
    };

    const filteredDetails = details.filter(item => {
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
              {viewMode === 'table' ? 'Client Requirements Breakdown' : 'Client Requirements (Raw JSON)'}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              {viewMode === 'table' && (
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="client-status-filter-label">Filter Status</InputLabel>
                  <Select
                    labelId="client-status-filter-label"
                    id="client-status-filter"
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
                  a.download = 'client_requirements.json';
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
                    {renderValue(summary)}
                  </Typography>
                </Paper>
              )}
              {details.length > 0 && (
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
                        sortedDetails.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                <span>{renderValue(item.requirement)}</span>
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
                              <span style={getStatusStyle(item.status)}>
                                {renderValue(item.status)}
                              </span>
                            </TableCell>
                            <TableCell>{renderValue(item.value_or_comment)}</TableCell>
                          </TableRow>
                        ))
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
                Active MongoDB Guidelines for Lender ({data.lender || 'Identified Lender'}):
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

  const allGuidelineItems = [];
  mongoClients.forEach(cl => {
    if (selectedClient !== 'all' && cl.collection !== selectedClient) return;
    (cl.guidelines || []).forEach(g => {
      if (clientSearch.trim()) {
        const q = clientSearch.toLowerCase();
        const matchName = (cl.display_name || '').toLowerCase().includes(q);
        const matchRemark = (g.remark || '').toLowerCase().includes(q);
        if (!matchName && !matchRemark) return;
      }
      allGuidelineItems.push({
        client: cl.display_name,
        collection: cl.collection,
        remark: g.remark,
        date: g.date,
        id: g.id
      });
    });
  });

  return (
    <div id="client-requirement-check-section" className="card shadow mb-4">
      <div className="card-header CAR1 bg-primary text-white d-flex justify-content-between align-items-center">
        <strong>Client Requirement Check</strong>
        <Chip
          label="MongoDB Instruction (Common + 39 Lenders)"
          size="small"
          sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 500 }}
        />
      </div>
      <div className="card-body">
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Button
              onClick={handleCheck}
              variant="contained"
              color="secondary"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Check Client Requirements'}
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
                    MongoDB Lender / Client Guidelines (Live Database)
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
                    onClick={handleCheck}
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
                    onClick={() => fetchMongoClients(true)}
                    disabled={mongoLoading}
                  >
                    Refresh
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => {
                      navigator.clipboard.writeText(CLIENT_REQUIREMENT_PROMPT);
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
                  <Typography variant="body2" color="text.secondary">Loading client guidelines from MongoDB cluster...</Typography>
                </Box>
              ) : mongoError ? (
                <Alert severity="error">{mongoError}</Alert>
              ) : (
                <>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 220 }}>
                      <InputLabel id="mongo-client-select-label">Select Lender/Client</InputLabel>
                      <Select
                        labelId="mongo-client-select-label"
                        id="mongo-client-select"
                        value={selectedClient}
                        label="Select Lender/Client"
                        onChange={(e) => setSelectedClient(e.target.value)}
                      >
                        <MenuItem value="all">All Lenders ({mongoClients.length})</MenuItem>
                        {mongoClients.map(cl => (
                          <MenuItem key={cl.collection} value={cl.collection}>
                            {cl.display_name} ({cl.count || cl.guidelines?.length || 0})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      size="small"
                      placeholder="Search lender or guideline text..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
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
                    Showing {allGuidelineItems.length} guidelines across {selectedClient === 'all' ? `${mongoClients.length} lenders` : selectedClient}
                  </Typography>

                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 380 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#f0f4f8' }}>
                          <TableCell sx={{ fontWeight: 'bold', width: '180px' }}>Lender / Client</TableCell>
                          <TableCell sx={{ fontWeight: 'bold' }}>Guideline / Requirement (from MongoDB)</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', width: '110px' }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 'bold', width: '60px', textAlign: 'center' }}>Copy</TableCell>
                          {isSuperuser && (
                            <TableCell sx={{ fontWeight: 'bold', width: '100px', textAlign: 'center' }}>Actions</TableCell>
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {allGuidelineItems.length > 0 ? (
                          allGuidelineItems.map((item, idx) => (
                            <TableRow key={item.id || idx} hover>
                              <TableCell>
                                <Chip
                                  label={item.client}
                                  size="small"
                                  color="secondary"
                                  variant="outlined"
                                  sx={{ fontWeight: 'bold', maxWidth: 170 }}
                                />
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'pre-wrap' }}>
                                <Typography variant="body2">{item.remark}</Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">
                                  {item.date ? String(item.date).split('T')[0] : '-'}
                                </Typography>
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
                            <TableCell colSpan={isSuperuser ? 5 : 4} align="center">
                              No guidelines match the selected client or search.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {mongoCommon && mongoCommon.length > 0 && selectedClient === 'all' && (
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f9f9f9', borderRadius: 1, border: '1px dashed #ccc' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        Common Guidelines for All Lenders ({mongoCommon.length}):
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 150, overflowY: 'auto' }}>
                        {mongoCommon.slice(0, 5).map((comm, cIdx) => (
                          <li key={cIdx}>
                            <Typography variant="caption">{comm}</Typography>
                          </li>
                        ))}
                      </Box>
                    </Box>
                  )}
                </>
              )}
            </Paper>
          </Collapse>

          {/* Add Client Guideline Dialog */}
          <Dialog open={openAddDialog} onClose={() => !crudLoading && setOpenAddDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <AddIcon color="success" /> Add Lender Guideline (MongoDB)
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Add a new guideline to a specific lender collection in the <strong>Instruction</strong> database.
                </Typography>

                <FormControl size="small" fullWidth>
                  <InputLabel id="add-client-select-label">Lender / Client</InputLabel>
                  <Select
                    labelId="add-client-select-label"
                    value={addForm.client}
                    label="Lender / Client"
                    onChange={(e) => setAddForm(prev => ({ ...prev, client: e.target.value }))}
                  >
                    {mongoClients.map(cl => (
                      <MenuItem key={cl.collection} value={cl.display_name}>
                        {cl.display_name} ({cl.collection})
                      </MenuItem>
                    ))}
                    <MenuItem value="__new__" sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                      + Enter New / Other Lender Name...
                    </MenuItem>
                  </Select>
                </FormControl>

                {addForm.client === '__new__' && (
                  <TextField
                    label="New Lender / Client Name"
                    fullWidth
                    size="small"
                    value={addForm.customClient}
                    onChange={(e) => setAddForm(prev => ({ ...prev, customClient: e.target.value }))}
                    placeholder="e.g. Apex Lending Corp"
                    required
                  />
                )}

                <TextField
                  label="Guideline / Requirement Remark"
                  fullWidth
                  multiline
                  rows={4}
                  value={addForm.remark}
                  onChange={(e) => setAddForm(prev => ({ ...prev, remark: e.target.value }))}
                  placeholder="Enter specific instructions or requirements for this lender..."
                  required
                />

                <TextField
                  label="Effective Date"
                  type="date"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={addForm.date}
                  onChange={(e) => setAddForm(prev => ({ ...prev, date: e.target.value }))}
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
                disabled={
                  crudLoading ||
                  !addForm.remark.trim() ||
                  (addForm.client === '__new__' ? !addForm.customClient.trim() : !addForm.client)
                }
                startIcon={crudLoading ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
              >
                {crudLoading ? 'Adding...' : 'Add Guideline'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Edit Client Guideline Dialog */}
          <Dialog open={openEditDialog} onClose={() => !crudLoading && setOpenEditDialog(false)} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <EditIcon color="primary" /> Edit Lender Guideline (MongoDB)
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Lender / Collection:
                  </Typography>
                  <Chip
                    label={`${editForm.client} (${editForm.collection})`}
                    color="secondary"
                    variant="outlined"
                    sx={{ fontWeight: 'bold', mt: 0.5 }}
                  />
                </Box>

                <TextField
                  label="Guideline / Requirement Remark"
                  fullWidth
                  multiline
                  rows={4}
                  value={editForm.remark}
                  onChange={(e) => setEditForm(prev => ({ ...prev, remark: e.target.value }))}
                  required
                />

                <TextField
                  label="Date"
                  type="date"
                  size="small"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={editForm.date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
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
                disabled={crudLoading || !editForm.remark.trim()}
                startIcon={crudLoading ? <CircularProgress size={18} color="inherit" /> : <EditIcon />}
              >
                {crudLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Client Guideline Confirmation Dialog */}
          <Dialog open={openDeleteDialog} onClose={() => !crudLoading && setOpenDeleteDialog(false)} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
              <DeleteOutlineIcon color="error" /> Confirm Delete
            </DialogTitle>
            <DialogContent>
              <DialogContentText>
                Are you sure you want to permanently delete this guideline for <strong>{itemToDelete?.client}</strong> (Collection: <code>{itemToDelete?.collection}</code>) from MongoDB?
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

export default ClientRequirementCheck;
