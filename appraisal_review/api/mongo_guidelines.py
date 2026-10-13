"""
MongoDB Guidelines Service for Appraisal Review
Extracts state and client requirements guidelines directly from MongoDB cluster.
"""

import logging
import re
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
from urllib.parse import quote_plus
from bson import ObjectId
import pymongo

logger = logging.getLogger(__name__)

# MongoDB Connection Configuration (as provided)
USERNAME = "strdjrbservices_db_user"
PASSWORD = "Strdjrbservices@41$"
CLUSTER = "cluster0.qb6aw8z.mongodb.net"

MONGO_URI = (
    f"mongodb+srv://{USERNAME}:{quote_plus(PASSWORD)}@{CLUSTER}/"
)

# Collections to exclude from lender/client search
NON_LENDER_COLLECTIONS = {
    'State_Requirements', 'posts', 'test', 'createCollection', 'sgfgfg', 'fdfafd',
    '3333333', 'ssrs', 'sham', 'DJRB',
    '1004C', '1004D', '1025', '1073', '2055_Exterior_only', '2090', '203K_FHA',
    '1007_Rent_Schedule', 'Commercial_narrative', 'Commercial_Narrative_-_Appraisa',
    'Commercial_Limited_Use', 'Desktop_appraisal', 'Desk_review', 'Field_review',
    'Land_appraisal', 'CDAIR_Exterior_Interior', 'ACE_+_PDR', 'Compliance_inspection_HUD_92051',
    'Always_Reject', 'HOLD_files', 'New_Update', 'Escalation_Points', 'Unpaid_OK',
    'As-is_+_ARV_reports', 'BMR_(Below_Market_Rate)'
}

# Alias mapping for friendly search matching
CLIENT_COLLECTION_ALIASES = {
    'plaza': 'Plaza_home_mortage',
    'plazahome': 'Plaza_home_mortage',
    'plazahomemortgage': 'Plaza_home_mortage',
    'visio': 'Visio_Lending_',
    'visiolending': 'Visio_Lending_',
    'best2lend': 'Best2Lend_LLC',
    'icelender': 'Ice_Lender',
    'ice': 'Ice_Lender',
    'equitywave': 'Equity_Wave_Lending,_Inc',
    'equitywavelending': 'Equity_Wave_Lending,_Inc',
    'hometown': 'Hometown_equity',
    'hometownequity': 'Hometown_equity',
    'foundation': 'FOUNDATION_MORTGAGE',
    'foundationmortgage': 'FOUNDATION_MORTGAGE',
    'bpl': 'BPL_Mortgage,_LLC',
    'bplmortgage': 'BPL_Mortgage,_LLC',
    'raincity': 'Rain_City_Capital',
    'raincitycapital': 'Rain_City_Capital',
    'thelender': 'TheLender',
    'eastcoast': 'East_Coast_Capital_Corp',
    'eastcoastcapital': 'East_Coast_Capital_Corp',
    'civic': 'CIVIC_',
    'nationalloan': 'National_Loan_Funding_LLC',
    'easystreet': 'National_Loan_Funding_LLC',
    'capitalfunding': 'Capital_Funding_Financial',
    'sierrapacific': 'Sierra_Pacific_Mortgage_Company',
    'templeview': 'Temple_View',
    'kind': 'Kind_lending',
    'kindlending': 'Kind_lending',
    'loandepot': 'Loandepot',
    'dart': 'Dart_Bank',
    'dartbank': 'Dart_Bank',
    'theloanstore': 'The_Loan_Store',
    'loanstore': 'The_Loan_Store',
    'champions': 'Champions_funding',
    'championsfunding': 'Champions_funding',
    'gfl': 'GFL_Capital_Mortgage',
    'gflcapital': 'GFL_Capital_Mortgage',
    'futures': 'Futures_Financial',
    'futuresfinancial': 'Futures_Financial',
    'cardinal': 'Cardinal_Financial_Company',
    'cardinalfinancial': 'Cardinal_Financial_Company',
    'deephaven': 'Deephaven_Mortgage_LLC',
    'ocmbc': 'OCMBC',
    'loanguys': 'Loanguys.com_inc',
    'paramount': 'Paramount_Residential_Mortgage_',
    'arc': 'Arc',
    'archome': 'Arc',
    'cv3': 'CV3_Financial',
    'cv3financial': 'CV3_Financial',
    'nationwide': 'Nationwide_mortgage_bankers',
    'logan': 'Logan_Financial',
    'loganfinance': 'Logan_Financial',
    'newamerican': 'New_American_Funding',
    'newamericanfunding': 'New_American_Funding',
    'haus': 'Haus_Capital',
    'hauscapital': 'Haus_Capital',
}

# Cache containers
_cache = {
    "state_requirements": None,
    "state_by_code": None,
    "client_collections": None,
    "client_guidelines": {},
    "common_guidelines": None,
    "field_revision_rules": None,
    "rules_by_field": None,
    "last_fetched": 0,
    "ttl": 600  # 10 minutes cache
}

_mongo_client = None


def clear_cache():
    """Clears all cached guideline and validation rule data."""
    _cache["state_requirements"] = None
    _cache["state_by_code"] = None
    _cache["client_collections"] = None
    _cache["client_guidelines"] = {}
    _cache["common_guidelines"] = None
    _cache["field_revision_rules"] = None
    _cache["rules_by_field"] = None
    _cache["last_fetched"] = 0


def get_mongo_client():
    """Initializes or returns singleton pymongo client."""
    global _mongo_client
    if _mongo_client is None:
        try:
            _mongo_client = pymongo.MongoClient(
                MONGO_URI,
                serverSelectionTimeoutMS=20000,
                socketTimeoutMS=20000,
                connect=False,
                maxPoolSize=10,
            )
        except Exception as e:
            logger.error(f"Error creating PyMongo client: {e}")
            raise
    return _mongo_client


def _clean_str(s: Any) -> str:
    return re.sub(r'[^a-z0-9]', '', str(s).lower())


def _format_display_name(collection_name: str) -> str:
    """Creates a human-friendly display name from collection name."""
    name = collection_name.strip('_')
    name = name.replace('_', ' ')
    name = re.sub(r'\s+', ' ', name)
    return name


def get_state_requirements(force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Fetches all state requirements from db['Instruction']['State_Requirements'].
    Returns a list of standardized dicts:
    [
        {"id": "...", "state_raw": "...", "state": "CA", "remark": "..."},
        ...
    ]
    """
    now = time.time()
    if not force_refresh and _cache["state_requirements"] is not None and (now - _cache["last_fetched"]) < _cache["ttl"]:
        return _cache["state_requirements"]

    try:
        client = get_mongo_client()
        db = client["Instruction"]
        collection = db["State_Requirements"]

        records = []
        state_map: Dict[str, List[str]] = {}

        for doc in collection.find({}):
            st = doc.get("STATE ") or doc.get("STATE") or doc.get("State") or ""
            st_str = str(st).strip()

            # Extract 2-letter state code, e.g. "COLORADO(CO)" -> "CO", "OH" -> "OH"
            m = re.search(r'\(([A-Z]{2})\)', st_str)
            if m:
                state_code = m.group(1)
            else:
                parts = st_str.split()
                first = parts[0].upper() if parts else ""
                state_code = first[:2] if len(first) >= 2 else (first or "GENERAL")

            remark = doc.get("REMARK") or doc.get("Remark") or doc.get("remark") or ""
            remark_clean = str(remark).strip()

            if not remark_clean:
                continue

            item = {
                "id": str(doc.get("_id", "")),
                "state_raw": st_str,
                "state": state_code,
                "remark": remark_clean
            }
            records.append(item)

            if state_code not in state_map:
                state_map[state_code] = []
            if remark_clean not in state_map[state_code]:
                state_map[state_code].append(remark_clean)

        records.sort(key=lambda x: (x["state"], x["remark"]))
        _cache["state_requirements"] = records
        _cache["state_by_code"] = state_map
        _cache["last_fetched"] = now
        return records
    except Exception as e:
        logger.error(f"Error fetching state requirements from MongoDB: {e}")
        if _cache["state_requirements"]:
            return _cache["state_requirements"]
        return []


def get_guidelines_for_state(state_code: str) -> List[str]:
    """Retrieves remarks for a specific state code from MongoDB."""
    if _cache["state_by_code"] is None:
        get_state_requirements()

    state_map = _cache["state_by_code"] or {}
    clean_code = str(state_code or "").strip().upper()
    return state_map.get(clean_code, [])


def get_available_client_collections() -> List[str]:
    """Retrieves list of lender/client collections in db['Instruction']."""
    try:
        client = get_mongo_client()
        db = client["Instruction"]
        all_cols = db.list_collection_names()
        lender_cols = sorted([c for c in all_cols if c not in NON_LENDER_COLLECTIONS])
        _cache["client_collections"] = lender_cols
        return lender_cols
    except Exception as e:
        logger.error(f"Error fetching collection names: {e}")
        return _cache["client_collections"] or list(CLIENT_COLLECTION_ALIASES.values())


def match_lender_to_collection(lender_name: str) -> Optional[str]:
    """Matches lender name string to the corresponding MongoDB collection name."""
    clean = _clean_str(lender_name)
    available = get_available_client_collections()

    # 1. Alias lookup
    for alias, col_target in CLIENT_COLLECTION_ALIASES.items():
        if alias in clean or clean in alias:
            if col_target in available:
                return col_target

    # 2. Direct string match
    for col in available:
        col_c = _clean_str(col)
        if col_c in clean or clean in col_c:
            return col

    return None


def get_client_requirements(client_name: Optional[str] = None, force_refresh: bool = False) -> Dict[str, Any]:
    """
    Fetches client requirements from MongoDB.
    If client_name is provided, returns guidelines for that specific client.
    If client_name is None, returns guidelines for all available clients and list of client names.
    """
    client = get_mongo_client()
    db = client["Instruction"]
    available_cols = get_available_client_collections()

    # Load common guidelines
    common_remarks = []
    if "Common_for_all_lenders" in db.list_collection_names():
        for doc in db["Common_for_all_lenders"].find({}):
            r = doc.get("Remark") or doc.get("REMARK") or doc.get("Update") or ""
            if r and str(r).strip() not in common_remarks:
                common_remarks.append(str(r).strip())

    if client_name:
        matched_col = match_lender_to_collection(client_name)
        if not matched_col:
            return {
                "matched": False,
                "client_searched": client_name,
                "collection": None,
                "guidelines": [],
                "common": common_remarks
            }

        # Check client cache
        if not force_refresh and matched_col in _cache["client_guidelines"]:
            return {
                "matched": True,
                "client_searched": client_name,
                "collection": matched_col,
                "display_name": _format_display_name(matched_col),
                "guidelines": _cache["client_guidelines"][matched_col],
                "common": common_remarks
            }

        remarks = []
        for doc in db[matched_col].find({}):
            r = doc.get("Remark") or doc.get("REMARK") or doc.get("Update") or ""
            d = doc.get("Date") or doc.get("DATE") or doc.get("Date ") or ""
            if r and str(r).strip():
                remarks.append({
                    "id": str(doc.get("_id", "")),
                    "remark": str(r).strip(),
                    "date": str(d)
                })

        _cache["client_guidelines"][matched_col] = remarks
        return {
            "matched": True,
            "client_searched": client_name,
            "collection": matched_col,
            "display_name": _format_display_name(matched_col),
            "guidelines": remarks,
            "common": common_remarks
        }

    # Fetch all clients list (fast cached)
    if not force_refresh and _cache.get("all_clients") is not None:
        return {
            "total_clients": len(_cache["all_clients"]),
            "clients": _cache["all_clients"],
            "common": common_remarks
        }

    # Build client listing with available collections
    all_clients = []
    for col_name in available_cols:
        # If already cached in client_guidelines, use cached remarks
        cached_remarks = _cache["client_guidelines"].get(col_name)
        if cached_remarks is not None:
            remarks = cached_remarks
        else:
            col = db[col_name]
            remarks = []
            for doc in col.find({}):
                r = doc.get("Remark") or doc.get("REMARK") or doc.get("Update") or ""
                d = doc.get("Date") or doc.get("DATE") or doc.get("Date ") or ""
                if r and str(r).strip():
                    remarks.append({
                        "id": str(doc.get("_id", "")),
                        "remark": str(r).strip(),
                        "date": str(d)
                    })
            _cache["client_guidelines"][col_name] = remarks

        all_clients.append({
            "collection": col_name,
            "display_name": _format_display_name(col_name),
            "count": len(remarks),
            "guidelines": remarks
        })

    _cache["all_clients"] = all_clients
    return {
        "total_clients": len(all_clients),
        "clients": all_clients,
        "common": common_remarks
    }


def get_guideline_for_lender(lender_name: str) -> List[str]:
    """Returns list of guideline remark strings for a detected lender."""
    res = get_client_requirements(client_name=lender_name)
    if res.get("matched"):
        return [g["remark"] for g in res.get("guidelines", [])]
    return []


def build_state_requirements_prompt() -> str:
    """Builds a dynamic state requirements prompt from MongoDB guidelines."""
    reqs = get_state_requirements()
    prompt = (
        "Analyze the appraisal report for state-specific requirements based on the property's state.\n"
        "Your output must be a single, clean JSON object. Do not include any text outside of the JSON object.\n"
        "The JSON object must have a \"summary\" (a one to two-line overview of findings) and a \"details\" array.\n"
        "Each object in the \"details\" array represents a requirement and must have the following keys:\n"
        "- \"requirement\": A string describing the state-specific rule being checked.\n"
        "- \"status\": A string, which must be one of 'Fulfilled', 'Not Fulfilled', or 'Not Applicable'.\n"
        "- \"value_or_comment\": A string containing the extracted value or a brief comment explaining the status. If a value is extracted, also include the page number.\n\n"
        "State-Specific Requirements (from MongoDB Instruction Database):\n"
    )

    by_state: Dict[str, List[str]] = {}
    for r in reqs:
        st = r["state"]
        if st not in by_state:
            by_state[st] = []
        by_state[st].append(r["remark"])

    for st, remarks in sorted(by_state.items()):
        prompt += f"- **{st}**:\n"
        for rm in remarks:
            single_line_rm = rm.replace("\n", " ").strip()
            prompt += f"  - {single_line_rm}\n"

    return prompt


def build_client_requirements_prompt(client_name: Optional[str] = None) -> str:
    """Builds a dynamic client requirements prompt from MongoDB guidelines."""
    prompt = (
        "Client Requirement Check:\n"
        "Based on the Lender/Client name in the document, verify if it matches any of a list of lenders/clients and check for any specific requirements.\n"
        "Your output must be a single, clean JSON object. Do not include any text outside of the JSON object.\n"
        "The JSON object must have a \"summary\" (a one to two-line overview stating which lender/client is present and if their requirements are met) and a \"details\" array.\n"
        "Each object in the \"details\" array represents a requirement and must have the following keys:\n"
        "- \"requirement\": A string describing the client-specific rule being checked.\n"
        "- \"status\": A string, which must be one of 'Fulfilled', 'Not Fulfilled', 'Needs Review', or 'Not Applicable'.\n"
        "- \"value_or_comment\": A string containing the extracted value or a brief comment explaining the status. If a value is extracted, also include the page number.\n\n"
        "Lender/Client List and their requirements (from MongoDB Instruction Database):\n"
    )

    data = get_client_requirements(client_name=client_name)
    if client_name and data.get("matched"):
        disp = data.get("display_name", client_name)
        prompt += f"- {disp}:\n"
        for g in data.get("guidelines", []):
            rm = g["remark"].replace("\n", " ").strip()
            prompt += f"  - {rm}\n"
    else:
        for cl in data.get("clients", []):
            disp = cl.get("display_name")
            prompt += f"- {disp}:\n"
            for g in cl.get("guidelines", []):
                rm = g["remark"].replace("\n", " ").strip()
                prompt += f"  - {rm}\n"

    return prompt


def clear_cache():
    """Clears all cached guideline data."""
    global _cache
    _cache["state_requirements"] = None
    _cache["state_by_code"] = None
    _cache["client_collections"] = None
    _cache["client_guidelines"] = {}
    _cache["all_clients"] = None
    _cache["common_guidelines"] = None
    _cache["last_fetched"] = 0


# =============================================================
# State Requirements CRUD
# =============================================================
def add_state_requirement(state: str, remark: str) -> Dict[str, Any]:
    """Adds a new state requirement to db['Instruction']['State_Requirements']."""
    st_clean = str(state or "").strip().upper()
    rm_clean = str(remark or "").strip()
    if not st_clean or not rm_clean:
        raise ValueError("State and Remark cannot be empty.")

    client = get_mongo_client()
    db = client["Instruction"]
    col = db["State_Requirements"]

    doc = {
        "STATE ": st_clean,
        "REMARK": rm_clean,
        "Date": datetime.now()
    }
    res = col.insert_one(doc)
    clear_cache()
    return {
        "id": str(res.inserted_id),
        "state": st_clean[:2] if len(st_clean) >= 2 else st_clean,
        "state_raw": st_clean,
        "remark": rm_clean
    }


def update_state_requirement(doc_id: str, state: Optional[str] = None, remark: Optional[str] = None) -> Dict[str, Any]:
    """Updates an existing state requirement in db['Instruction']['State_Requirements']."""
    if not doc_id:
        raise ValueError("Document ID is required.")

    update_fields = {}
    if state is not None and str(state).strip():
        update_fields["STATE "] = str(state).strip().upper()
    if remark is not None and str(remark).strip():
        update_fields["REMARK"] = str(remark).strip()

    if not update_fields:
        raise ValueError("No fields provided to update.")

    update_fields["UpdatedAt"] = datetime.now()

    client = get_mongo_client()
    db = client["Instruction"]
    col = db["State_Requirements"]

    oid = ObjectId(doc_id)
    res = col.update_one({"_id": oid}, {"$set": update_fields})
    if res.matched_count == 0:
        raise ValueError(f"State requirement with ID '{doc_id}' not found.")

    clear_cache()
    updated_doc = col.find_one({"_id": oid})
    st_val = updated_doc.get("STATE ") or updated_doc.get("STATE") or updated_doc.get("State") or ""
    rm_val = updated_doc.get("REMARK") or updated_doc.get("Remark") or ""
    return {
        "id": str(oid),
        "state": str(st_val).strip().upper()[:2],
        "state_raw": str(st_val).strip(),
        "remark": str(rm_val).strip()
    }


def delete_state_requirement(doc_id: str) -> bool:
    """Deletes a state requirement from db['Instruction']['State_Requirements']."""
    if not doc_id:
        raise ValueError("Document ID is required.")

    client = get_mongo_client()
    db = client["Instruction"]
    col = db["State_Requirements"]

    oid = ObjectId(doc_id)
    res = col.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise ValueError(f"State requirement with ID '{doc_id}' not found.")

    clear_cache()
    return True


# =============================================================
# Client Requirements CRUD
# =============================================================
def add_client_requirement(client_name: str, remark: str, date_str: Optional[str] = None) -> Dict[str, Any]:
    """
    Adds a new client requirement to MongoDB.
    If client exists, adds to its collection. If new client name, creates/uses new collection.
    """
    rm_clean = str(remark or "").strip()
    if not client_name or not rm_clean:
        raise ValueError("Client name and Remark cannot be empty.")

    matched_col = match_lender_to_collection(client_name)
    if not matched_col:
        # Create a new collection name based on clean client_name
        safe_name = re.sub(r'[^a-zA-Z0-9_]', '_', client_name.strip()).strip('_')
        matched_col = safe_name or "New_Client"

    client = get_mongo_client()
    db = client["Instruction"]
    col = db[matched_col]

    doc_date = date_str or datetime.now().strftime("%Y-%m-%d")
    doc = {
        "Remark": rm_clean,
        "Date": doc_date,
        "CreatedAt": datetime.now()
    }
    res = col.insert_one(doc)
    clear_cache()
    return {
        "id": str(res.inserted_id),
        "collection": matched_col,
        "display_name": _format_display_name(matched_col),
        "remark": rm_clean,
        "date": doc_date
    }


def update_client_requirement(collection_name: str, doc_id: str, remark: str, date_str: Optional[str] = None) -> Dict[str, Any]:
    """Updates an existing client requirement in the specified collection."""
    if not collection_name or not doc_id:
        raise ValueError("Collection name and Document ID are required.")
    rm_clean = str(remark or "").strip()
    if not rm_clean:
        raise ValueError("Remark cannot be empty.")

    client = get_mongo_client()
    db = client["Instruction"]
    if collection_name not in db.list_collection_names():
        raise ValueError(f"Collection '{collection_name}' does not exist.")

    col = db[collection_name]
    oid = ObjectId(doc_id)

    update_fields = {"Remark": rm_clean, "UpdatedAt": datetime.now()}
    if date_str:
        update_fields["Date"] = str(date_str).strip()

    res = col.update_one({"_id": oid}, {"$set": update_fields})
    if res.matched_count == 0:
        res = col.update_one({"_id": oid}, {"$set": {"REMARK": rm_clean, "UpdatedAt": datetime.now()}})
        if res.matched_count == 0:
            raise ValueError(f"Document with ID '{doc_id}' not found in '{collection_name}'.")

    clear_cache()
    updated_doc = col.find_one({"_id": oid})
    r_val = updated_doc.get("Remark") or updated_doc.get("REMARK") or updated_doc.get("Update") or ""
    d_val = updated_doc.get("Date") or updated_doc.get("DATE") or ""
    return {
        "id": str(oid),
        "collection": collection_name,
        "display_name": _format_display_name(collection_name),
        "remark": str(r_val).strip(),
        "date": str(d_val)
    }


def delete_client_requirement(collection_name: str, doc_id: str) -> bool:
    """Deletes a client requirement from the specified collection."""
    if not collection_name or not doc_id:
        raise ValueError("Collection name and Document ID are required.")

    client = get_mongo_client()
    db = client["Instruction"]
    if collection_name not in db.list_collection_names():
        raise ValueError(f"Collection '{collection_name}' does not exist.")

    col = db[collection_name]
    oid = ObjectId(doc_id)
    res = col.delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise ValueError(f"Document with ID '{doc_id}' not found in '{collection_name}'.")

    clear_cache()
    return True


# =====================================================================
# MongoDB Revision Database: Field Validation & Revision Rules Service
# =====================================================================

REVISION_COLLECTIONS = [
    'Subject', 'CONTRACT', 'SITE', 'Neighborhood', 'Improvements',
    'Reconciliation', 'SALES', 'COST_APPROACH', 'Signature',
    '1007', '1025_form', '1073_form', '1004C_form', '1004D_Reports',
    'Addendum', 'Escalation', 'FHA', '216_form', 'Revision_Language',
    'Additional_revisions', 'AS-IS+ARV_reports'
]

FIELD_KEYWORD_MAP = {
    # Subject
    'offered for sale': ['Offered for Sale in Last 12 Months', 'Offered for Sale'],
    'parcel': ["Assessor's Parcel #"],
    'apn': ["Assessor's Parcel #"],
    'borrower': ['Borrower', 'Borrower (and Co-Borrower)'],
    'address': ['Property Address', 'Full Address'],
    'lender': ['Lender/Client', 'LENDER/CLIENT Name'],
    'client': ['Lender/Client', 'LENDER/CLIENT Name'],
    'legal description': ['Legal Description'],
    'neighborhood name': ['Neighborhood Name'],
    'occupan': ['Occupant', 'Occupancy'],
    'vacant': ['Occupant', 'Occupancy'],
    'tenant': ['Occupant', 'Occupancy'],
    'pud': ['PUD', 'HOA $', 'PUD Fees $'],
    'hoa': ['HOA $', 'PUD'],
    'property rights': ['Property Rights Appraised'],
    'fee simple': ['Property Rights Appraised'],
    'leasehold': ['Property Rights Appraised'],
    'public record': ['Owner of Public Record', 'Is property seller owner of public record?'],
    'assignment type': ['Assignment Type'],
    'county': ['County'],
    'state': ['State'],
    'zip': ['Zip Code', 'Full Address'],

    # Contract
    'contract price': ['Contract Price $'],
    'purchase price': ['Contract Price $'],
    'date of contract': ['Date of Contract'],
    'concession': ['Is there any financial assistance (loan charges, sale concessions, gift or downpayment assistance, etc.) to be paid by any party on behalf of the borrower?', 'If Yes, report the total dollar amount and describe the items to be paid'],
    'financial assistance': ['Is there any financial assistance (loan charges, sale concessions, gift or downpayment assistance, etc.) to be paid by any party on behalf of the borrower?', 'If Yes, report the total dollar amount and describe the items to be paid'],
    'seller': ['Is property seller owner of public record?'],
    'data source': ['Data Source(s) (Contract)', 'Data Source(s)'],

    # Site
    'zoning compliance': ['Zoning Compliance'],
    'zoning description': ['Zoning Description'],
    'zoning': ['Zoning Compliance', 'Zoning Description', 'Specific Zoning Classification'],
    'highest and best use': ['Is the highest and best use of subject property as improved (or as proposed per plans and specifications) the present use?'],
    'hbu': ['Is the highest and best use of subject property as improved (or as proposed per plans and specifications) the present use?'],
    'flood': ['FEMA Special Flood Hazard Area', 'FEMA Flood Zone', 'FEMA Map #', 'FEMA Map Date'],
    'fema': ['FEMA Special Flood Hazard Area', 'FEMA Flood Zone', 'FEMA Map #', 'FEMA Map Date'],
    'utilities': ['Are the utilities and off-site improvements typical for the market area? If No, describe', 'Electricity', 'Gas', 'Water', 'Sanitary Sewer'],
    'septic': ['Sanitary Sewer'],
    'sewer': ['Sanitary Sewer'],
    'water': ['Water'],
    'well': ['Water'],
    'alley': ['Alley'],
    'street': ['Street'],
    'adverse site': ['Are there any adverse site conditions or external factors (easements, encroachments, environmental conditions, land uses, etc.)? If Yes, describe'],
    'area': ['Area', 'Site Size', 'Total Site Size'],

    # Neighborhood
    'predominant price': ['one unit housing price(high,low,pred)', 'Lowest Sale Price', 'Highest Sale Price', 'Median Sale Price'],
    'predominant age': ['one unit housing age(high,low,pred)'],
    'one-unit housing': ['one unit housing price(high,low,pred)', 'one unit housing age(high,low,pred)'],
    'boundaries': ['Neighborhood Boundaries'],
    'boundary': ['Neighborhood Boundaries'],
    'present land use': ['One-Unit', '2-4 Unit', 'Multi-Family', 'Commercial', 'Other'],
    'land use': ['One-Unit', '2-4 Unit', 'Multi-Family', 'Commercial', 'Other'],
    'built-up': ['Built-Up'],
    'growth': ['Growth'],
    'property values': ['Property Values'],
    'demand': ['Demand/Supply', 'Demand / Supply'],

    # Improvements
    'design': ['Design (Style)', 'Design (Style) Adjustment'],
    'style': ['Design (Style)', 'Design (Style) Adjustment'],
    'year built': ['Year Built', 'Year Built Adjustment'],
    'effective age': ['Effective Age (Yrs)'],
    'attic': ['Attic'],
    'deficiencies': ['Are there any physical deficiencies or adverse conditions that affect the livability, soundness, or structural integrity of the property? If Yes, describe'],
    'conform': ['Does the property generally conform to the neighborhood (functional utility, style, condition, use, construction, etc.)? If No, describe'],
    'foundation': ['Foundation Type', 'Foundation Walls (Material/Condition)'],
    'basement': ['Basement Area sq.ft.', 'Basement Finish %'],
    'heating': ['Fuel', 'Heating Type', 'Heating/Cooling'],
    'cooling': ['Cooling Type', 'Heating/Cooling'],
    'car storage': ['Car Storage'],
    'garage': ['Car Storage'],
    'condition': ['Overall Condition', 'Condition', 'Condition Adjustment', 'Describe the condition of the property'],
    'quality': ['Overall Quality', 'Quality of Construction', 'Quality of Construction Adjustment'],

    # Sales
    'actual age': ['Actual Age', 'Actual Age Adjustment'],
    'location adjustment': ['Location', 'Location Adjustment'],
    'gla': ['Gross Living Area', 'Gross Living Area Adjustment', 'Finished Area Above Grade'],
    'gross living area': ['Gross Living Area', 'Gross Living Area Adjustment'],
    'bath': ['Baths', 'Baths Adjustment'],
    'bedroom': ['Bedrooms', 'Bedrooms Adjustment'],
    'site adjustment': ['Site', 'Site Adjustment'],
    'view': ['View', 'View Adjustment'],
    'sale price': ['Sale Price'],
    'date of sale': ['Date of Sale/Time'],

    # Reconciliation
    'as is': ['This appraisal is made "as is", subject to completion per plans and specifications on the basis of a hypothetical condition that the improvements have been completed, subject to the following repairs or alterations on the basis of a hypothetical condition that the repairs or alterations have been completed, or subject to the following required inspection based on the extraordinary assumption that the condition or deficiency does not require alteration or repair:'],
    'subject to': ['This appraisal is made "as is", subject to completion per plans and specifications on the basis of a hypothetical condition that the improvements have been completed, subject to the following repairs or alterations on the basis of a hypothetical condition that the repairs or alterations have been completed, or subject to the following required inspection based on the extraordinary assumption that the condition or deficiency does not require alteration or repair:'],
    'effective date': ['Effective Date of Appraisal', 'as of'],
    'market value': ['opinion of the market value, as defined, of the real property that is the subject of this report is $', 'Indicated Value by Sales Comparison Approach $', 'final value'],

    # Cost Approach
    'cost approach': ['Indicated Value By Cost Approach......................................................=$', 'Cost Approach (if developed)'],
    'economic life': ['Remaining Economic Life'],
    'site value': ['OPINION OF SITE VALUE = $ ................................................'],

    # Signature / Certification
    'signature': ['Signature', 'Appraiser Signature', 'Supervisory Signature'],
    'license': ['LICENSE/REGISTRATION/CERTIFICATION #', 'State Certification #', 'or State License #'],
    'date of signature': ['Date of Signature and Report'],
    'supervisory': ['Supervisory Signature', 'Supervisory Name', 'Supervisory Company Name'],

    # FHA
    'fha': ['FHA Case No.'],
    'case #': ['FHA Case No.'],

    # Income / 1007
    'rent': ['Estimated Monthly Market Rent $', 'X Gross Rent Multiplier  = $'],
    'grm': ['X Gross Rent Multiplier  = $']
}


def match_rule_to_fields(remark: str, section: str) -> List[str]:
    """
    Extracts target field candidate names associated with a rule remark.
    Uses quoted field tokens and domain-specific keyword associations.
    """
    if not remark:
        return []

    fields = []
    # 1. Look for quoted strings in remark, e.g. 'Contract Price', "Zoning Compliance"
    quotes = re.findall(r"['‘\"“\uff07\uff02]([^'’\"”\uff07\uff02]+)['’\"”\uff07\uff02]", remark)
    for q in quotes:
        q_clean = q.strip()
        if 2 <= len(q_clean) <= 50 and not any(w in q_clean.lower() for w in ['please', 'see attached', 'subject to completion', 'as is']):
            if q_clean not in fields:
                fields.append(q_clean)

    # 2. Match against known domain keyword patterns
    rem_lower = remark.lower()
    for kw, target_fields in FIELD_KEYWORD_MAP.items():
        if kw in rem_lower:
            for tf in target_fields:
                if tf not in fields:
                    fields.append(tf)

    return fields


def get_field_revision_rules(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Fetches all field revision rules across collections in db['Revision'].
    Returns a dictionary organized by section and indexed by field candidates.
    """
    now = time.time()
    if not force_refresh and _cache.get("field_revision_rules") is not None and (now - _cache["last_fetched"]) < _cache["ttl"]:
        return _cache["field_revision_rules"]

    try:
        client = get_mongo_client()
        db = client["Revision"]
        available_cols = db.list_collection_names()

        sections_data: Dict[str, List[Dict[str, Any]]] = {}
        rules_by_field: Dict[str, List[Dict[str, Any]]] = {}
        total_rules = 0

        target_cols = [c for c in REVISION_COLLECTIONS if c in available_cols]
        # Include any remaining collections in Revision not explicitly listed
        for c in available_cols:
            if c not in target_cols and c not in ['admin', 'local', 'test']:
                target_cols.append(c)

        for col_name in target_cols:
            col = db[col_name]
            records = []
            for doc in col.find({}):
                raw_remark = doc.get("REMARK") or doc.get("RAMARK") or doc.get("Remark") or doc.get("Update") or ""
                remark_clean = str(raw_remark).strip()
                if not remark_clean:
                    continue

                sr_no = str(doc.get("SR.NO") or doc.get("SR.NO.") or doc.get("SR NO") or doc.get("DATE") or doc.get("Date") or "").strip()
                note = str(doc.get("NOTE") or doc.get("Note") or "").strip()

                field_hints = match_rule_to_fields(remark_clean, col_name)

                item = {
                    "id": str(doc.get("_id", "")),
                    "section": col_name,
                    "sr_no": sr_no,
                    "remark": remark_clean,
                    "note": note,
                    "field_hints": field_hints,
                    "source": f"MongoDB.Revision.{col_name}"
                }
                records.append(item)
                total_rules += 1

                # Index by candidate field names
                for fh in field_hints:
                    fh_clean = fh.lower().strip()
                    if fh_clean not in rules_by_field:
                        rules_by_field[fh_clean] = []
                    rules_by_field[fh_clean].append(item)

            if records:
                sections_data[col_name] = records

        result = {
            "sections": sections_data,
            "rules_by_field": rules_by_field,
            "total_rules": total_rules,
            "total_sections": len(sections_data),
            "timestamp": now
        }

        _cache["field_revision_rules"] = result
        _cache["rules_by_field"] = rules_by_field
        _cache["last_fetched"] = now
        logger.info(f"Loaded {total_rules} field revision rules from MongoDB Revision database across {len(sections_data)} collections.")
        return result
    except Exception as e:
        logger.error(f"Error fetching field revision rules from MongoDB Revision database: {e}")
        if _cache.get("field_revision_rules"):
            return _cache["field_revision_rules"]
        return {"sections": {}, "rules_by_field": {}, "total_rules": 0, "error": str(e)}


def get_rules_by_field_map(force_refresh: bool = False) -> Dict[str, List[Dict[str, Any]]]:
    """Retrieves index of rules mapped to field names."""
    if _cache.get("rules_by_field") is None or force_refresh:
        get_field_revision_rules(force_refresh=force_refresh)
    return _cache.get("rules_by_field") or {}


def get_rules_for_section(section_name: str, force_refresh: bool = False) -> List[Dict[str, Any]]:
    """Retrieves all rules for a specific section (e.g. 'Subject', 'CONTRACT', 'SITE')."""
    rules_dict = get_field_revision_rules(force_refresh=force_refresh)
    sections = rules_dict.get("sections", {})
    clean_target = section_name.strip().lower()
    for sec_key, items in sections.items():
        if sec_key.lower() == clean_target:
            return items
    return []


