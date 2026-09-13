import type { TranslationKey } from "./index";

/**
 * English mirrors `el.ts`. This is typed as a complete record of the Greek keys,
 * so omitting one is a compile error rather than a silent gap at runtime.
 */
export const en: Record<TranslationKey, string> = {
  "app.name": "PromoterOS",

  "nav.campaigns": "Campaigns",
  "nav.promoters": "Promoters",
  "nav.shifts": "Shifts",
  "nav.settings": "Settings",
  "nav.today": "Today",
  "nav.label": "Main navigation",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.loading": "Loading…",
  "common.copy": "Copy",
  "common.km_away": "{km} km away",

  "shift.coverage": "{filled} of {required} filled",
  "shift.status.open": "Open",
  "shift.status.partially_filled": "Partially filled",
  "shift.status.filled": "Filled",

  "match.title": "Recommended promoters",
  "match.invite": "Invite",
  "match.available": "Available",
  "match.has_car": "Has a car",
  "match.brief_completed": "Brief completed",
  "match.brand_experience": "Brand experience",
  "match.why_ranked": "Why this ranking",
  "match.none": "No available promoter for this shift.",
  "match.factor.distance": "Distance",
  "match.factor.brand_experience": "Brand experience",
  "match.factor.category_experience": "Similar campaign experience",
  "match.factor.skill_overlap": "Matching skills",
  "match.factor.brief_completed": "Brief",
  "match.factor.reliability": "Reliability",
  "match.brand_shifts": "{count} shifts for this client",

  "shifts.title": "Shifts",
  "shifts.none": "No shifts yet.",
  "shifts.list.subtitle": "{count} shifts, earliest first.",
  "shifts.empty.title": "No shifts yet",
  "shifts.empty.body":
    "Shifts live inside a campaign. Create your first campaign and add its shifts to it.",
  "shifts.empty.cta": "Create a campaign",
  "shifts.date": "Date",
  "shifts.store": "Store",
  "shifts.campaign": "Campaign",
  "shifts.needed": "People",

  "invitation.title": "New shift",
  "invitation.question": "Are you available?",
  "invitation.accept": "Accept",
  "invitation.decline": "Decline",
  "invitation.accepted": "Thank you! The shift is confirmed.",
  "invitation.declined": "Thanks for letting us know.",
  "invitation.expired": "This invitation has expired.",

  "checkin.title": "Arrival at the store",
  "checkin.confirm": "Confirm arrival",
  "checkin.success": "Your arrival has been recorded.",
  "checkin.too_far": "You appear to be far from the store.",
  "checkin.override": "I'm here, the GPS is wrong",
  "checkin.privacy":
    "Your location is captured only at this moment, to confirm arrival. We do not store your coordinates and we do not track you.",

  "landing.logo_alt": "PromoterOS logo",
  "landing.language.el": "EL",
  "landing.language.en": "EN",
  "landing.eyebrow": "For promotion & field-staffing agencies",
  "landing.title": "Fewer calls. Every shift covered.",
  "landing.lede":
    "PromoterOS finds the right promoters, organises invitations and changes, and gives your team a clear view of the field.",
  "landing.hero_note":
    "Built with agencies that want to spend their time on clients and growth — not on endless messages.",
  "landing.product_label": "A clear way to run operations",
  "landing.product_title": "The coordinator sees only what needs attention.",
  "landing.product_lede":
    "From promoter selection to check-in and field reporting, every campaign has one reliable operating picture.",
  "landing.benefit_1_title": "Find the right promoter",
  "landing.benefit_1_body":
    "Recommendations based on availability, distance, experience, skills, briefs and reliability — with a clear explanation.",
  "landing.benefit_2_title": "Cover cancellations quickly",
  "landing.benefit_2_body":
    "When a shift changes, see suitable replacements immediately and start invitations from one place.",
  "landing.benefit_3_title": "Keep track of the field without chasing",
  "landing.benefit_3_body":
    "Check-ins, photos and field reports stay connected to the relevant shift and campaign.",
  "landing.footer": "PromoterOS — promotion operations, in sync.",
  "landing.privacy": "Privacy policy",

  "waitlist.title": "Request early access",
  "waitlist.intro": "Be among the first agencies to see PromoterOS.",
  "waitlist.full_name": "Full name",
  "waitlist.work_email": "Work email",
  "waitlist.company": "Company",
  "waitlist.job_title": "Role",
  "waitlist.promoter_count": "How many promoters do you manage?",
  "waitlist.choose_count": "Choose a range",
  "waitlist.count_1_30": "1–30",
  "waitlist.count_31_100": "31–100",
  "waitlist.count_101_300": "101–300",
  "waitlist.count_300_plus": "300+",
  "waitlist.challenge": "Which task takes the most time today? (optional)",
  "waitlist.submit": "Join the waitlist",
  "waitlist.submitting": "Saving…",
  "waitlist.privacy_note":
    "We use your business details only to assess interest and contact you about early access.",
  "waitlist.website": "Website",
  "waitlist.status.idle": "",
  "waitlist.status.success": "Thank you — your registration is saved. We will contact you when early access opens.",
  "waitlist.status.already_joined": "This email is already on the waitlist. Thank you for your interest.",
  "waitlist.status.invalid": "Check the required fields and try again.",
  "waitlist.status.error": "We could not save your registration right now. Please try again shortly.",

  "privacy.title": "Waitlist privacy policy",
  "privacy.intro": "How we use the details you provide for PromoterOS early access.",
  "privacy.controller_title": "Data controller",
  "privacy.controller_body": "{company} is responsible for waitlist details. For privacy matters, contact {email}.",
  "privacy.data_title": "Details we collect",
  "privacy.data_body": "We collect your name, work email, company, role, promoter team size and anything you choose to share about your operational needs.",
  "privacy.purpose_title": "Why we use them",
  "privacy.purpose_body": "We use these details only to assess interest in PromoterOS, shape the product around agency needs and contact you about early access.",
  "privacy.basis_title": "Lawful basis",
  "privacy.basis_body": "Processing is based on steps you request before a potential commercial relationship and our legitimate interest in assessing demand and responsibly developing the product. We do not use a consent checkbox as the lawful basis.",
  "privacy.retention_title": "Retention period",
  "privacy.retention_body": "We retain these details for up to 12 months after registration, unless a commercial relationship begins or you ask us to delete them earlier.",
  "privacy.rights_title": "Your rights",
  "privacy.rights_body": "You can request access, correction, deletion or restriction of processing by contacting the email above.",
  "privacy.back": "Back to the waitlist",

  "auth.login_title": "Sign in",
  "auth.login_intro": "We will email you a single-use link. No password needed.",
  "auth.email_label": "Work email",
  "auth.email_placeholder": "name@agency.gr",
  "auth.send_link": "Send me a link",
  "auth.sending": "Sending…",
  "auth.link_sent": "If that address has access, the link is on its way. Open it on this same device.",
  "auth.link_failed": "That link has expired or was already used. Request a new one.",
  "auth.error_invalid_email": "Enter a valid email address.",
  "auth.error_rate_limited": "Too many attempts. Try again in a few minutes.",
  "auth.error_generic": "We could not send the link right now. Please try again.",
  "auth.no_agency_title": "This account is not attached to an agency yet",
  "auth.no_agency_body": "You are signed in, but this address has not been assigned to an agency, so no data is visible to you. Ask your administrator to grant access.",
  "auth.signed_in_as": "Signed in as {email}",
  "auth.sign_out": "Sign out",
  "auth.completing": "Signing you in…",
  "auth.code_label": "Or enter the code from the email",
  "auth.code_hint":
    "Six digits. Works even when the link did not — some mail providers consume a one-time link by scanning it.",
  "auth.code_submit": "Sign in with code",
  "auth.code_checking": "Checking…",
  "auth.code_invalid": "That code is wrong or has expired. Request a new one.",
  "auth.create_agency_cta": "Create your agency",

  "promoters.add": "Add promoter",
  "promoters.value_yes": "Yes",
  "promoters.value_no": "No",
  "promoters.missing_coordinates": "No coordinates",

  "promoters.new.title": "New promoter",
  "promoters.new.subtitle": "Enter their details — the address is only used to find coordinates.",
  "promoters.edit.title": "Edit — {name}",
  "promoters.edit.archive_section_title": "Archive",
  "promoters.edit.archive_description":
    "An archived promoter is no longer suggested for new shifts, but their history stays intact. Never deleted.",
  "promoters.edit.archive_button": "Archive promoter",
  "promoters.edit.archive_confirm_prompt": "Are you sure you want to archive this promoter?",
  "promoters.edit.archive_confirm_yes": "Yes, archive",
  "promoters.edit.archive_confirm_cancel": "Cancel",
  "promoters.edit.archived_notice": "This promoter is archived. Change the status above to \"Active\" to bring them back.",

  "promoters.list.subtitle": "{count} promoters",
  "promoters.list.low_count_hint":
    "The ranking only makes sense with a handful of promoters — add at least 5-8 across different areas before trying a shift.",

  "promoters.filter.search_label": "Search",
  "promoters.filter.search_placeholder": "Name or phone",
  "promoters.filter.status_label": "Status",
  "promoters.filter.all_statuses": "All statuses",
  "promoters.filter.area_label": "Area",
  "promoters.filter.all_areas": "All areas",
  "promoters.filter.skill_label": "Skill",
  "promoters.filter.all_skills": "All skills",
  "promoters.filter.car_label": "Car",
  "promoters.filter.car_any": "Anyone",
  "promoters.filter.car_yes": "Has a car",
  "promoters.filter.car_no": "No car",
  "promoters.filter.apply": "Filter",
  "promoters.filter.clear": "Clear filters",
  "promoters.filter.result_count": "{shown} of {total}",

  "promoters.empty.title": "No promoters yet",
  "promoters.empty.description":
    "Add your first promoters — you need at least 5-8, across different areas and with different transport and skills, before ranking a shift means anything.",
  "promoters.empty_filtered.title": "No results",
  "promoters.empty_filtered.description": "No promoter matches these filters. Try changing them or clear them.",

  "promoters.table.name": "Name",
  "promoters.table.phone": "Phone",
  "promoters.table.areas": "Areas",
  "promoters.table.transport": "Transport",
  "promoters.table.skills": "Skills",
  "promoters.table.reliability": "Reliability",
  "promoters.table.status": "Status",
  "promoters.table.reliability_aria": "Reliability for {name}",

  "promoters.status.active": "Active",
  "promoters.status.paused": "Paused",
  "promoters.status.archived": "Archived",
  "promoters.status.blocklisted": "Blocklisted",

  "promoters.errors.full_name_required": "Enter their full name.",
  "promoters.errors.email_invalid": "Enter a valid email, or leave it blank.",
  "promoters.errors.birth_year_invalid": "Enter a valid birth year.",
  "promoters.errors.coordinates_invalid": "The coordinates are not valid.",
  "promoters.errors.coordinates_incomplete": "Fill in both coordinate fields.",
  "promoters.errors.phone_required": "Enter a phone number (at least 6 digits).",
  "promoters.errors.save_failed": "We could not save this promoter. Please try again.",
  "promoters.errors.not_found": "This promoter could not be found.",
  "promoters.errors.duplicate_phone": "A promoter with this phone number already exists.",
  "promoters.errors.duplicate_phone_link": "View promoter",

  "promoters.form.section_basics": "Basic details",
  "promoters.form.full_name": "Full name",
  "promoters.form.phone": "Phone",
  "promoters.form.phone_hint": "e.g. 6971234567 or +30 697 123 4567",
  "promoters.form.email": "Email",
  "promoters.form.birth_year": "Birth year",
  "promoters.form.section_address": "Address & location",
  "promoters.form.address_intro": "The address is only used to find coordinates — it is not stored as text.",
  "promoters.form.address_label": "Home address",
  "promoters.form.address_placeholder": "e.g. Ermou 12, Glyfada",
  "promoters.form.geocode_button": "Find coordinates",
  "promoters.form.geocode_found": "Found — confirm the location below is correct before saving.",
  "promoters.form.geocode_found_low": "This match is uncertain — check the coordinates below carefully before saving.",
  "promoters.form.geocode_not_found":
    "We could not automatically find this address — common with Greek addresses. Enter coordinates manually below, or save this promoter without them for now.",
  "promoters.form.lat_label": "Latitude",
  "promoters.form.lng_label": "Longitude",
  "promoters.form.manual_coords_hint": "You can always correct these by hand, even after an automatic match.",
  "promoters.form.section_transport": "Transport",
  "promoters.form.has_car_label": "Has a car",
  "promoters.form.has_licence_label": "Has a licence",
  "promoters.form.transport_notes_label": "Transport notes",
  "promoters.form.section_areas": "Work areas",
  "promoters.form.areas_hint": "Which areas they are willing to work in.",
  "promoters.form.no_areas_configured": "No areas set up for this agency yet.",
  "promoters.form.section_skills": "Skills",
  "promoters.form.no_skills_configured": "No skills set up for this agency yet.",
  "promoters.form.level_label": "Level",
  "promoters.form.level_1": "Basic",
  "promoters.form.level_2": "Good",
  "promoters.form.level_3": "Excellent",
  "promoters.form.status_label": "Status",
  "promoters.form.reactivate_hint": "Choose \"Active\" above to bring them back.",
  "promoters.form.save_new": "Save promoter",
  "promoters.form.save_changes": "Save changes",

  "promoters.profile.edit_button": "Edit",
  "promoters.profile.availability_button": "Availability",
  "promoters.profile.missing_coordinates_banner":
    "This promoter has no coordinates, so they cannot be ranked correctly by distance.",
  "promoters.profile.details_title": "Details",
  "promoters.profile.reliability_label": "Reliability",
  "promoters.profile.areas_title": "Work areas",
  "promoters.profile.no_areas": "No areas set.",
  "promoters.profile.skills_title": "Skills",
  "promoters.profile.no_skills": "No skills set.",
  "promoters.profile.client_history_title": "Client history",
  "promoters.profile.client_history_empty": "No client history yet.",
  "promoters.profile.table.client": "Client",
  "promoters.profile.table.shifts_completed": "Shifts",
  "promoters.profile.table.last_worked": "Last worked",
  "promoters.profile.table.avg_rating": "Avg. rating",
  "promoters.profile.upcoming_shifts_title": "Upcoming shifts",
  "promoters.profile.upcoming_empty": "No upcoming shifts scheduled.",
  "promoters.profile.table.assignment_status": "Status",
  "promoters.profile.past_shifts_title": "Past shifts",
  "promoters.profile.past_empty": "No past shifts.",

  "campaigns.status.draft": "Draft",
  "campaigns.status.active": "Active",
  "campaigns.status.completed": "Completed",
  "campaigns.status.cancelled": "Cancelled",

  "campaigns.shift_status.open": "Open",
  "campaigns.shift_status.partially_filled": "Partially filled",
  "campaigns.shift_status.filled": "Filled",
  "campaigns.shift_status.completed": "Completed",
  "campaigns.shift_status.cancelled": "Cancelled",

  "campaigns.weekday.mon": "Mon",
  "campaigns.weekday.tue": "Tue",
  "campaigns.weekday.wed": "Wed",
  "campaigns.weekday.thu": "Thu",
  "campaigns.weekday.fri": "Fri",
  "campaigns.weekday.sat": "Sat",
  "campaigns.weekday.sun": "Sun",

  "campaigns.list.title": "Campaigns",
  "campaigns.list.subtitle": "Every campaign for this agency, with shift coverage at a glance.",
  "campaigns.list.new_button": "New campaign",
  "campaigns.list.empty_title": "No campaigns yet",
  "campaigns.list.empty_body":
    "A campaign links a client to the stores and shifts that need promoters. Create the first one to start inviting.",
  "campaigns.list.col_name": "Campaign",
  "campaigns.list.col_client": "Client",
  "campaigns.list.col_dates": "Dates",
  "campaigns.list.col_status": "Status",
  "campaigns.list.col_shifts": "Shifts",
  "campaigns.list.col_coverage": "Coverage",
  "campaigns.list.shift_count": "{count} shifts",

  "campaigns.new.title": "New campaign",
  "campaigns.new.subtitle": "Client, dates, rate and the skills it calls for.",
  "campaigns.new.section_client": "Client",
  "campaigns.new.client_existing": "Existing client",
  "campaigns.new.client_new": "New client",
  "campaigns.new.client_select_label": "Client",
  "campaigns.new.client_select_placeholder": "Choose a client",
  "campaigns.new.new_client_name_label": "New client name",
  "campaigns.new.no_clients_hint": "No clients yet for this agency — add the first one below.",
  "campaigns.new.name_label": "Campaign name",
  "campaigns.new.type_label": "Campaign type",
  "campaigns.new.type_hint": "e.g. sampling, brand activation, roadshow",
  "campaigns.new.starts_on_label": "Start date",
  "campaigns.new.ends_on_label": "End date",
  "campaigns.new.dress_code_label": "Dress code",
  "campaigns.new.rate_label": "Hourly rate (EUR)",
  "campaigns.new.rate_hint": "e.g. 4.50",
  "campaigns.new.skills_label": "Skills this campaign calls for",
  "campaigns.new.skills_hint": "Used for promoter matching — select the ones that apply.",
  "campaigns.new.skills_none": "No skills recorded for this agency yet.",
  "campaigns.new.submit": "Create campaign",
  "campaigns.new.submitting": "Creating…",
  "campaigns.new.error.client_save_failed": "We could not save the new client. Please try again.",
  "campaigns.new.error.save_failed": "We could not save the campaign. Please try again.",

  "campaigns.detail.back": "← Campaigns",
  "campaigns.detail.overview_title": "Campaign details",
  "campaigns.detail.dates_label": "Dates",
  "campaigns.detail.status_label": "Status",
  "campaigns.detail.rate_label": "Hourly rate",
  "campaigns.detail.dress_code_label": "Dress code",
  "campaigns.detail.brief_title": "Brief",
  "campaigns.detail.brief_none": "No brief has been written yet.",
  "campaigns.detail.brief_published": "Published",
  "campaigns.detail.brief_draft": "Draft — not published yet",
  "campaigns.detail.brief_edit": "Edit brief",
  "campaigns.detail.brief_write": "Write brief",
  "campaigns.detail.stores_title": "Stores",
  "campaigns.detail.stores_none": "No stores added yet — they are added along with shifts.",
  "campaigns.detail.shifts_title": "Shifts",
  "campaigns.detail.shifts_none_title": "No shifts yet",
  "campaigns.detail.shifts_none_body":
    "Add shifts to start inviting promoters — you can create several at once.",
  "campaigns.detail.add_shifts": "Add shifts",
  "campaigns.detail.col_coverage": "Coverage",
  "campaigns.detail.status_title": "Campaign status",
  "campaigns.detail.mark_active": "Activate",
  "campaigns.detail.mark_completed": "Mark completed",
  "campaigns.detail.cancel": "Cancel campaign",
  "campaigns.detail.cancel_confirm":
    "Cancel the campaign '{name}'? Its shifts stay on record, but the campaign will be marked cancelled.",

  "campaigns.shifts_new.back": "← Back to campaign",
  "campaigns.shifts_new.title": "Add shifts",
  "campaigns.shifts_new.subtitle": "For {campaign}",
  "campaigns.shifts_new.section_store": "Store",
  "campaigns.shifts_new.store_existing": "Existing store",
  "campaigns.shifts_new.store_new": "New store",
  "campaigns.shifts_new.store_select_label": "Store",
  "campaigns.shifts_new.store_select_placeholder": "Choose a store",
  "campaigns.shifts_new.no_stores_hint": "No stores yet for this client — add the first one below.",
  "campaigns.shifts_new.new_store_name_label": "Store name",
  "campaigns.shifts_new.new_store_address_label": "Address",
  "campaigns.shifts_new.new_store_lat_label": "Latitude",
  "campaigns.shifts_new.new_store_lng_label": "Longitude",
  "campaigns.shifts_new.new_store_coords_hint":
    "Manual coordinates for now — find them on Google Maps. Automatic geocoding comes later.",
  "campaigns.shifts_new.section_schedule": "Schedule",
  "campaigns.shifts_new.from_date_label": "From date",
  "campaigns.shifts_new.to_date_label": "To date",
  "campaigns.shifts_new.to_date_hint": "Same as 'from' for a single day.",
  "campaigns.shifts_new.weekdays_label": "Days",
  "campaigns.shifts_new.start_time_label": "Start time",
  "campaigns.shifts_new.end_time_label": "End time",
  "campaigns.shifts_new.promoters_required_label": "People per shift",
  "campaigns.shifts_new.rate_override_label": "Rate for these shifts (EUR, optional)",
  "campaigns.shifts_new.rate_override_hint": "Leave blank to use the campaign's rate.",
  "campaigns.shifts_new.preview_count": "{count} shifts will be created",
  "campaigns.shifts_new.preview_none": "Choose dates and days to see how many shifts will be created.",
  "campaigns.shifts_new.submit": "Create shifts",
  "campaigns.shifts_new.submitting": "Creating…",
  "campaigns.shifts_new.error.store_save_failed": "We could not save the new store. Please try again.",
  "campaigns.shifts_new.error.save_failed": "We could not save the shifts. Please try again.",

  "campaigns.brief.back": "← Back to campaign",
  "campaigns.brief.title": "Campaign brief",
  "campaigns.brief.subtitle": "For {campaign}",
  "campaigns.brief.title_label": "Title",
  "campaigns.brief.body_label": "Content (markdown)",
  "campaigns.brief.body_hint": "Simple markdown is supported — promoters see this after being invited.",
  "campaigns.brief.default_title": "Brief — {campaign}",
  "campaigns.brief.save_draft": "Save draft",
  "campaigns.brief.publish": "Publish",
  "campaigns.brief.saving": "Saving…",
  "campaigns.brief.error.save_failed": "We could not save the brief. Please try again.",

  "campaigns.validation.required": "Fill in this field.",
  "campaigns.validation.too_long": "This text is too long.",
  "campaigns.validation.name_length": "Needs at least 2 characters.",
  "campaigns.validation.client_required": "Choose a client or add a new one.",
  "campaigns.validation.new_client_name": "Give the new client a name (at least 2 characters).",
  "campaigns.validation.date_invalid": "Enter a valid date.",
  "campaigns.validation.date_order": "The end date must be on or after the start date.",
  "campaigns.validation.rate_invalid": "Enter a valid amount, e.g. 4.50.",
  "campaigns.validation.store_required": "Choose a store or add a new one.",
  "campaigns.validation.new_store_name": "Give the new store a name (at least 2 characters).",
  "campaigns.validation.coords_invalid": "Enter valid coordinates.",
  "campaigns.validation.time_invalid": "Enter a valid time.",
  "campaigns.validation.time_order": "The end time must be after the start time.",
  "campaigns.validation.promoters_required": "Enter a headcount of at least 1.",
  "campaigns.validation.weekdays_none": "Choose at least one day.",
  "campaigns.validation.no_dates": "No shift dates came out of that — check the range and the days.",
  "campaigns.validation.campaign_not_found": "Campaign not found.",

  "checkin.expired": "This link has expired or is invalid.",
  "checkin.locating": "Finding your location…",
  "checkin.submitting": "Submitting…",
  "checkin.recorded_far_note": "We recorded it anyway — your coordinator has been notified.",
  "checkin.go_to_report": "Continue to the report",
  "checkin.override_prompt": "We couldn't confirm your location. You can check in manually.",
  "checkin.override_reason_label": "Reason (optional)",
  "checkin.override_reason_placeholder": "e.g. my phone's GPS isn't working",
  "checkin.override_submit": "Check in manually",
  "checkin.retry_geo": "Try GPS again",
  "checkin.geo_denied": "Location access was not allowed.",
  "checkin.geo_unavailable": "We couldn't get your location.",
  "checkin.geo_timeout": "Finding your location took too long. Try again.",
  "checkin.geo_unsupported": "Your browser does not support location.",
  "checkin.geo_insecure": "Location requires a secure connection (HTTPS).",
  "checkin.already_checked_in_error": "Arrival has already been recorded.",
  "checkin.save_failed": "We couldn't save your check-in. Please try again.",
  "checkin.brief_title": "Brief",
  "checkin.already_done": "Your check-in and report are both done. Thank you!",
  "checkin.not_yet_time": "This shift hasn't started yet.",

  "report.title": "Shift report",
  "report.units_promoted_label": "Units promoted",
  "report.sales_count_label": "Sales",
  "report.interactions_count_label": "Customer interactions",
  "report.stock_issues_label": "Stock issues",
  "report.store_manager_name_label": "Store manager's name",
  "report.notes_label": "Notes",
  "report.photos_label": "Photos",
  "report.photos_hint": "Optional. You can add more than one.",
  "report.submit": "Save report",
  "report.submitting": "Saving…",
  "report.success": "Report saved. Thank you!",
  "report.success_with_photo_failures": "Report saved, but some photos didn't upload. The report itself is already saved.",
  "report.validation.number_invalid": "Enter a valid non-negative number.",
  "report.validation.too_long": "This text is too long.",
  "report.error.save_failed": "We couldn't save the report. Please try again.",
  "report.error.checkin_required": "You need to check in first.",
  "report.error.already_submitted": "This report has already been submitted.",
  "report.error.cancelled": "This shift has been cancelled.",
  "report.checkin_required_notice": "You need to check in at the store first.",
  "report.back_to_checkin": "Check in",
  "report.already_submitted": "This report has already been submitted. Thank you!",

  "waitlist.status.rate_limited": "Too many signup attempts from this connection. Please try again shortly.",

  "shifts.coverage.filled": "{filled} of {required} filled",
  "shifts.coverage.full": "This shift is fully staffed.",

  "shifts.board.title": "Shift status",
  "shifts.board.none_title": "No invitations sent yet",
  "shifts.board.none_description": "Invite the first candidate below to start covering this shift.",
  "shifts.board.column.promoter": "Promoter",
  "shifts.board.column.state": "State",
  "shifts.board.column.detail": "Detail",
  "shifts.board.column.actions": "Actions",
  "shifts.board.state.awaiting_reply": "Awaiting reply",
  "shifts.board.state.expired": "Expired, no answer",
  "shifts.board.state.declined": "Declined",
  "shifts.board.state.confirmed": "Confirmed",
  "shifts.board.state.checked_in": "Checked in (GPS)",
  "shifts.board.state.checked_in_manual": "Checked in (manual override)",
  "shifts.board.state.no_show": "No show",
  "shifts.board.state.cancelled": "Cancelled",
  "shifts.board.sent_at": "Sent: {when}",
  "shifts.board.expires_at": "Expires: {when}",
  "shifts.board.responded_at": "Responded: {when}",
  "shifts.board.confirmed_at": "Confirmed: {when}",
  "shifts.board.checked_in_at": "Checked in: {when}",
  "shifts.board.cancelled_at": "Cancelled: {when}",
  "shifts.board.distance": "{m} m from the store",
  "shifts.board.within_geofence": "Inside the store geofence",
  "shifts.board.outside_geofence": "Outside the store geofence",
  "shifts.board.reason_label": "Reason: {reason}",
  "shifts.board.started_no_checkin": "The shift has started and there is still no check-in.",
  "shifts.board.cancel_action": "Cancel assignment",
  "shifts.board.cancel_confirm": "Cancel {name}'s assignment?",
  "shifts.board.cancel_reason_label": "Cancellation reason (optional)",
  "shifts.board.cancel_reason_placeholder": "e.g. called in sick",
  "shifts.board.no_show_action": "No show",
  "shifts.board.no_show_confirm": "Record that {name} did not show up for this shift?",
  "shifts.board.error.missing_ids": "The form is missing data. Please reload the page.",
  "shifts.board.error.not_found": "This assignment could not be found.",
  "shifts.board.error.not_confirmed": "This assignment is no longer confirmed.",
  "shifts.board.error.save_failed": "That change did not save. Please try again.",

  "shifts.replacements.title": "Next candidates",
  "shifts.replacements.why_title": "Why this shift needs a replacement",
  "shifts.replacements.declined": "{name} declined — {when}",
  "shifts.replacements.cancelled": "{name}'s assignment was cancelled — {when}",
  "shifts.replacements.pending_count": "{count} invitations awaiting reply",
  "shifts.replacements.score_label": "Match score for {name}",
  "shifts.replacements.reinvite": "Invite",

  // --- P19 — accounts, team and onboarding --------------------------------

  "onboarding.signin.title": "Sign in to continue",
  "onboarding.signin.body":
    "Send yourself a sign-in link and come back here to create your agency.",
  "onboarding.signin.cta": "Sign in",

  "onboarding.create.title": "Create your agency",
  "onboarding.create.subtitle": "Three details and you are in. You become the account owner.",
  "onboarding.create.name_label": "Agency name",
  "onboarding.create.name_hint": "As your clients know it. Your team sees it on their invitations.",
  "onboarding.create.name_placeholder": "e.g. Field Force Athens",
  "onboarding.create.city_label": "Home city",
  "onboarding.create.city_hint": "Optional. Where you mostly work.",
  "onboarding.create.city_placeholder": "e.g. Athens",
  "onboarding.create.timezone_label": "Timezone",
  "onboarding.create.timezone_hint": "Every shift time is shown in this timezone.",
  "onboarding.create.full_name_label": "Your name",
  "onboarding.create.full_name_hint": "Optional. This is how your team will see you.",
  "onboarding.create.submit": "Create agency",
  "onboarding.create.submitting": "Creating…",
  "onboarding.create.trial_note": "14-day trial. No card required.",
  "onboarding.create.invited_instead":
    "Invited by a colleague? Open the link from your email instead of creating a new agency.",

  "onboarding.errors.name_too_short": "Enter the agency name (at least 2 characters).",
  "onboarding.errors.name_too_long": "That name is too long (120 characters maximum).",
  "onboarding.errors.city_too_long": "That city is too long (80 characters maximum).",
  "onboarding.errors.timezone_invalid": "Choose one of the available timezones.",
  "onboarding.errors.already_in_agency":
    "You already belong to an agency. One account belongs to exactly one agency.",
  "onboarding.errors.not_authenticated": "Your session expired. Sign in again and retry.",
  "onboarding.errors.no_email": "Your account has no email address. Sign in again with an email link.",
  "onboarding.errors.unknown": "That did not save. Reload the page and try again.",

  "onboarding.title": "Your first steps",
  "onboarding.subtitle": "{agency} — three steps to your first ranked shift.",
  "onboarding.progress": "{done} of {total} steps done",
  "onboarding.trial_ends": "trial ends {date}",
  "onboarding.skip_all": "I'll do this later",
  "onboarding.settings_link": "Settings and team",
  "onboarding.step.done": "Done",
  "onboarding.step.optional": "Optional",
  "onboarding.step.count": "{count} of {target}",
  "onboarding.step.promoters.title": "Add your first three promoters",
  "onboarding.step.promoters.why": "With fewer than three, the ranking has nothing to compare.",
  "onboarding.step.promoters.cta": "New promoter",
  "onboarding.step.campaign.title": "Create your first campaign",
  "onboarding.step.campaign.why":
    "A campaign holds the client, the store and the rate — a shift needs all three.",
  "onboarding.step.campaign.cta": "New campaign",
  "onboarding.step.shift.title": "Open your first shift",
  "onboarding.step.shift.why":
    "The shift is what you offer: date, time, store, how many people.",
  "onboarding.step.shift.cta": "Go to campaigns",
  "onboarding.step.team.title": "Invite your team",
  "onboarding.step.team.why":
    "Your coordinators work on the same data, without sharing one password.",
  "onboarding.step.team.cta": "Invite",
  "onboarding.aha.title": "See the ranking",
  "onboarding.aha.body":
    "Open the shift and see which promoters fit — and why each one ranked where it did.",
  "onboarding.aha.locked":
    "You need a shift before there is a ranking. Ideally {count} promoters too, so the order means something.",
  "onboarding.aha.cta": "Open the shift",
  "onboarding.aha.locked_cta": "Create a shift",

  "onboarding.join.title": "Team invitation",
  "onboarding.join.invited_to": "You have been invited to {agency}",
  "onboarding.join.role_label": "Role",
  "onboarding.join.sent_to": "Sent to {email}",
  "onboarding.join.expires": "Expires {when}",
  "onboarding.join.signin_title": "Sign in to accept",
  "onboarding.join.signin_body":
    "This invitation is only valid for {email}. We will send a sign-in link and bring you back here.",
  "onboarding.join.signin_cta": "Sign in",
  "onboarding.join.accept_body": "Accepting gives you access to {agency}'s data.",
  "onboarding.join.accept": "Accept invitation",
  "onboarding.join.accepting": "Accepting…",
  "onboarding.join.wrong_email_title": "You are signed in with a different email",
  "onboarding.join.wrong_email_body":
    "This invitation was sent to {invited}, but you are signed in as {current}. Sign out and sign in with the right address.",
  "onboarding.join.sign_out_and_return": "Sign out and come back here",
  "onboarding.join.already_in_agency_body":
    "You already belong to an agency, so this invitation is not needed. One account belongs to exactly one agency.",
  "onboarding.join.go_to_app": "Go to shifts",
  "onboarding.join.invalid_title": "This link is not valid",
  "onboarding.join.invalid_body": "Ask the account owner to send you a new invitation.",
  "onboarding.join.expired_title": "This invitation has expired",
  "onboarding.join.expired_body":
    "Invitations are valid for seven days. Ask the account owner for a new one.",
  "onboarding.join.used_title": "This invitation has already been used",
  "onboarding.join.used_body":
    "Each invitation works once. If you are already a member, just sign in.",
  "onboarding.join.error_way_out": "Go to your first steps",

  "team.title": "Team",
  "team.subtitle": "Who has access to {agency}'s data.",
  "team.back_to_settings": "Settings",
  "team.seats": "{used} of {limit} seats in use",
  "team.members_title": "Members",
  "team.you": "(you)",
  "team.readonly_notice":
    "Only the account owner can invite people, change roles and remove members.",
  "team.no_agency_title": "You do not belong to an agency yet",
  "team.no_agency_body": "Create your agency, or open the invitation link you were sent.",
  "team.no_agency_cta": "Create an agency",
  "team.status.active": "Active",
  "team.status.invited": "Pending",
  "team.status.removed": "Removed",
  "team.role.owner": "Owner",
  "team.role.coordinator": "Coordinator",
  "team.role.supervisor": "Supervisor",
  "team.role.admin": "Admin",

  "team.invite.title": "Invite a colleague",
  "team.invite.subtitle":
    "You send them a link. They sign in with their own email — no shared passwords.",
  "team.invite.email_label": "Colleague's email",
  "team.invite.email_hint": "The invitation works only for this address, and only for seven days.",
  "team.invite.email_placeholder": "name@agency.gr",
  "team.invite.role_label": "Role",
  "team.invite.role_hint":
    "A coordinator sees and runs the work. Only an owner manages the team.",
  "team.invite.submit": "Create invitation",
  "team.invite.submitting": "Creating…",
  "team.invite.sent_title": "The invitation for {email} is ready",
  "team.invite.sent_body":
    "Send this link to your colleague. It works once and expires in seven days.",
  "team.invite.copy_link": "Copy link",
  "team.invite.copied": "Copied",
  "team.invite.no_seats_title": "No free seats",
  "team.invite.no_seats_body":
    "Remove a member or cancel a pending invitation to free a seat.",

  "team.pending_title": "Pending invitations",
  "team.pending_none_title": "No pending invitations",
  "team.pending_none_body": "Anyone you invite appears here until they sign in.",
  "team.pending.expires": "Expires {when}",
  "team.pending.expired": "Expired {when}",
  "team.pending.revoke": "Cancel",

  "team.removed_title": "Members without access",
  "team.removed_body": "Their history stays. You can invite them back at any time.",

  "team.role_change.label": "Role",
  "team.role_change.submit": "Change role",
  "team.role_change.done": "Role changed.",
  "team.role_change.self_blocked": "You cannot change your own role.",
  "team.role_change.last_owner_blocked":
    "This is the last owner. Make someone else an owner first.",

  "team.remove.action": "Remove from team",
  "team.remove.confirm_title": "Remove {name}?",
  "team.remove.consequence_access": "They lose access to all agency data immediately.",
  "team.remove.consequence_history": "Their name stays on everything they created.",
  "team.remove.consequence_seat": "A seat is freed and you can invite them back later.",
  "team.remove.confirm": "Yes, remove them",
  "team.remove.cancel": "Cancel",
  "team.remove.self_blocked": "You cannot remove yourself.",
  "team.remove.last_owner_blocked": "This is the last owner and cannot be removed.",

  "team.errors.not_authenticated": "Your session expired. Sign in again and retry.",
  "team.errors.not_owner": "Only the account owner can do this.",
  "team.errors.no_agency": "Your account is not linked to an agency.",
  "team.errors.no_email": "Your account has no email address. Sign in again with an email link.",
  "team.errors.email_invalid": "Enter a valid email address.",
  "team.errors.role_invalid": "Choose one of the available roles.",
  "team.errors.token_invalid": "The invitation link was not created properly. Try again.",
  "team.errors.already_member": "That address already belongs to someone on your team.",
  "team.errors.belongs_to_other_agency":
    "That address already belongs to another agency. One account belongs to exactly one agency.",
  "team.errors.seat_limit_reached":
    "You have reached your plan's seat limit. Free a seat or upgrade.",
  "team.errors.seat_limit_reached_accept":
    "The agency has no free seat right now. Ask the owner to free one.",
  "team.errors.invitation_not_found": "That invitation could not be found. Ask for a new one.",
  "team.errors.invitation_used": "That invitation has already been used.",
  "team.errors.invitation_expired": "That invitation has expired. Ask for a new one.",
  "team.errors.invitation_email_mismatch": "That invitation was sent to a different email address.",
  "team.errors.already_in_agency": "You already belong to an agency.",
  "team.errors.member_not_found": "That person is not on your team.",
  "team.errors.member_inactive": "That person already has no access.",
  "team.errors.cannot_change_own_role": "You cannot change your own role.",
  "team.errors.cannot_remove_self": "You cannot remove yourself.",
  "team.errors.last_owner": "An agency must always have at least one owner.",
  "team.errors.signing_secret_missing":
    "TOKEN_SIGNING_SECRET is not configured, so no invitation link can be signed.",
  "team.errors.unknown": "That did not go through. Reload the page and try again.",

  "settings.title": "Settings",
  "settings.subtitle": "Your agency account and your team.",
  "settings.agency.title": "Agency",
  "settings.agency.name": "Name",
  "settings.agency.city": "City",
  "settings.agency.timezone": "Timezone",
  "settings.agency.plan": "Plan",
  "settings.agency.status": "Subscription status",
  "settings.agency.trial_ends": "Trial ends",
  "settings.agency.seats": "Seats",
  "settings.agency.promoter_limit": "Promoters",
  "settings.agency.promoter_usage": "{used} of {limit}",
  "settings.agency.change_note":
    "Changing the name or the plan arrives with billing, in a later release.",
  "settings.plan.starter": "Starter",
  "settings.plan.agency": "Agency",
  "settings.plan.multi_brand": "Multi-brand",
  "settings.subscription.trialing": "Trialing",
  "settings.subscription.active": "Active",
  "settings.subscription.past_due": "Payment due",
  "settings.subscription.canceled": "Cancelled",
  "settings.subscription.paused": "Paused",
  "settings.card.team_title": "Team",
  "settings.card.team_body_owner": "Invite colleagues, change roles and remove access.",
  "settings.card.team_body_staff": "See who has access to your agency's data.",
  "settings.card.team_cta": "Manage team",
  "settings.card.onboarding_title": "Your first steps",
  "settings.card.onboarding_body":
    "You have not reached your first ranked shift yet. Pick up where you left off.",
  "settings.card.onboarding_cta": "Continue",

  // --- P17 billing -----------------------------------------------------------------------
  "billing.title": "Billing",
  "billing.subtitle": "Subscription and invoices for {agency}.",
  "billing.back_to_settings": "Back to settings",

  "billing.owner_only_title": "Billing is visible to the owner only",
  "billing.owner_only_body":
    "The subscription and invoices are visible only to the agency owner. Ask them to open this page, or to give you the owner role.",

  "billing.no_agency_title": "No agency found",
  "billing.no_agency_body":
    "Your account is not attached to an agency, so there is no subscription to show.",
  "billing.no_agency_cta": "Create an agency",

  "billing.not_configured_title": "Billing is not switched on yet",
  "billing.not_configured_body":
    "No Stripe key is configured on this installation, so a subscription cannot be started. Everything else works normally and the state below is real.",
  "billing.test_mode": "Stripe test mode: nothing on this installation charges real money.",

  "billing.status.trialing": "Trialing",
  "billing.status.active": "Active",
  "billing.status.past_due": "Payment due",
  "billing.status.canceled": "Cancelled",
  "billing.status.paused": "Paused",

  "billing.access.full": "Full access",
  "billing.access.grace": "Full access, with a warning",
  "billing.access.read_only": "Read and export only",

  "billing.notice.trial_ending.title": "Your trial ends soon",
  "billing.notice.trial_ending.body":
    "{days} days of trial left. Pick a plan to carry on without interruption.",
  "billing.notice.trial_expired.title": "Your trial has ended",
  "billing.notice.trial_expired.body":
    "You keep full access for another {days} days. After that the account becomes read and export only — nothing is deleted.",
  "billing.notice.past_due.title": "A payment failed",
  "billing.notice.past_due.body":
    "The card was declined. You keep full access for {days} days — no shift stops. Update the card from billing management.",
  "billing.notice.grace_ending.title": "Only a few days left",
  "billing.notice.grace_ending.body":
    "In {days} days the account becomes read-only unless the payment goes through. Your data stays exactly where it is.",
  "billing.notice.read_only_unpaid.title": "The account is read-only",
  "billing.notice.read_only_unpaid.body":
    "You can see and export everything, but not make changes. One payment unlocks it immediately. We never delete your data over an unpaid invoice.",
  "billing.notice.paused.title": "The subscription is paused",
  "billing.notice.paused.body":
    "You can see and export everything. To start working again, resume the subscription from billing management.",
  "billing.notice.canceled.title": "The subscription was cancelled",
  "billing.notice.canceled.body":
    "The account is read and export only. Your data stays where it is and comes back the moment you subscribe again.",

  "billing.current.title": "Current subscription",
  "billing.current.plan": "Plan",
  "billing.current.status": "Status",
  "billing.current.trial_ends": "Trial ends",
  "billing.current.trial_days": "{date} — {days} days left",
  "billing.current.renews": "Next renewal",
  "billing.current.access": "Access",
  "billing.current.no_subscription":
    "No active subscription yet. The agency runs on the Starter plan's limits.",

  "billing.usage.title": "Usage",
  "billing.usage.seats": "Team logins",
  "billing.usage.promoters": "Promoters",
  "billing.usage.of_limit": "{used} of {limit}",
  "billing.usage.at_limit": "At the limit",
  "billing.usage.note":
    "A limit only blocks adding more. Everything that already exists keeps working.",

  "billing.plans.title": "Plans",
  "billing.plans.subtitle":
    "A flat price per agency, not per promoter: the same bill in December and in August.",
  "billing.plan.starter": "Starter",
  "billing.plan.agency": "Agency",
  "billing.plan.multi_brand": "Multi-brand",
  "billing.plan.seats": "{count} team logins",
  "billing.plan.seats_unlimited": "Unlimited team logins",
  "billing.plan.promoters": "Up to {count} promoters",
  "billing.plan.price_missing": "This plan's price has not been created in Stripe yet.",

  "billing.interval.per_month": "/ month",
  "billing.interval.per_year": "/ year",
  "billing.interval.annual_effective": "{price} a month, two months free",
  "billing.interval.switch_to_annual": "Annual billing — two months free",
  "billing.interval.switch_to_monthly": "Monthly billing",

  "billing.cta.subscribe": "Start subscription",
  "billing.cta.change_plan": "Change plan",
  "billing.cta.current_plan": "Current plan",
  "billing.cta.working": "Opening Stripe…",

  "billing.portal.title": "Card, invoices and cancellation",
  "billing.portal.body":
    "Changing the card, invoices, VAT id and cancellation all happen on Stripe's own page. Card details never pass through our servers.",
  "billing.portal.cta": "Manage billing",
  "billing.portal.unavailable": "Available once the first subscription has started.",

  "billing.checkout.success_title": "Payment received",
  "billing.checkout.success_body":
    "Stripe tells us within a few seconds. If the state below has not changed, refresh the page.",
  "billing.checkout.cancelled_title": "Subscription not completed",
  "billing.checkout.cancelled_body": "Nothing was charged. You can try again whenever you like.",

  "billing.data_note":
    "We never delete your data because an invoice went unpaid. You can export all of it at any time.",
  "billing.contact_note": "Signed in as {email}.",

  "billing.errors.not_owner": "Only the agency owner can change the subscription.",
  "billing.errors.no_agency":
    "Your account is not attached to an agency. Finish creating an agency first.",
  "billing.errors.not_configured":
    "Billing is not switched on for this installation. Nothing is missing on your side.",
  "billing.errors.price_missing":
    "That plan has no price in Stripe yet. Pick another plan or try again later.",
  "billing.errors.plan_invalid": "Unknown plan. Pick one of the three above.",
  "billing.errors.no_customer":
    "There is no Stripe customer yet. Start a subscription first.",
  "billing.errors.stripe_unavailable":
    "Stripe did not answer. Try again shortly — nothing was charged.",
  "billing.errors.unknown":
    "That did not go through. Try again; if it keeps happening, send us the message you see.",

  // P18 — admin console. Internal tool for PromoterOS staff, not agency users, so English
  // labels are used in both dictionaries (CLAUDE.md's bilingual rule is about the customer-
  // facing product). Every string still goes through t() and both files stay complete.
  "admin.nav.agencies": "Agencies",
  "admin.nav.audit": "Audit log",
  "admin.nav.waitlist": "Waitlist",
  "admin.title": "Platform admin",
  "admin.subtitle": "Signed in as {name}",

  "admin.agencies.title": "Agencies",
  "admin.agencies.subtitle":
    "Every tenant on the platform. Counts are aggregates — open an agency for detail.",
  "admin.agencies.search_placeholder": "Search by name…",
  "admin.agencies.col.name": "Agency",
  "admin.agencies.col.plan": "Plan",
  "admin.agencies.col.status": "Status",
  "admin.agencies.col.trial_ends": "Trial ends",
  "admin.agencies.col.users": "Users",
  "admin.agencies.col.promoters": "Promoters",
  "admin.agencies.col.campaigns": "Campaigns",
  "admin.agencies.col.shifts": "Shifts",
  "admin.agencies.col.created": "Created",
  "admin.agencies.suspended_badge": "Suspended",
  "admin.agencies.deletion_badge": "Deletion requested",
  "admin.agencies.empty_title": "No agencies yet",
  "admin.agencies.empty_body": "Agencies appear here once someone signs up.",
  "admin.agencies.view": "View",

  "admin.agency.back": "Back to agencies",
  "admin.agency.aggregates_title": "At a glance — an aggregate view, always visible",
  "admin.agency.city_label": "City",
  "admin.agency.timezone_label": "Timezone",
  "admin.agency.reason_gate_title": "View operational detail",
  "admin.agency.reason_gate_body":
    "Recent campaigns and shifts are this agency's operational data. Opening them is logged with your reason, before anything is shown. The aggregates above needed no reason.",
  "admin.agency.reason_label": "Reason",
  "admin.agency.reason_hint":
    "Required, at least 10 characters — this is written to the audit log.",
  "admin.agency.reason_placeholder": "e.g. investigating support ticket #123",
  "admin.agency.reason_submit": "View detail",
  "admin.agency.reason_submitting": "Logging and loading…",
  "admin.agency.recent_campaigns": "Recent campaigns",
  "admin.agency.recent_shifts": "Recent shifts",
  "admin.agency.no_recent_campaigns": "No campaigns yet.",
  "admin.agency.no_recent_shifts": "No shifts yet.",
  "admin.agency.actions_toggle_on": "Enable actions for this agency",
  "admin.agency.actions_toggle_off": "Exit action mode",
  "admin.agency.actions_mode_banner":
    "Action mode is on. Every action below is logged with your reason.",
  "admin.agency.action_done": "Done. This was written to the audit log.",
  "admin.agency.extend_trial.title": "Extend trial",
  "admin.agency.extend_trial.days_label": "Days to add",
  "admin.agency.extend_trial.submit": "Extend trial",
  "admin.agency.extend_trial.done": "Trial extended to {when}.",
  "admin.agency.change_plan.title": "Change plan",
  "admin.agency.change_plan.plan_label": "New plan",
  "admin.agency.change_plan.submit": "Change plan",
  "admin.agency.change_plan.done": "Plan changed to {plan}.",
  "admin.agency.suspend.title": "Suspend agency",
  "admin.agency.suspend.body":
    "Reversible, never destructive — nothing is deleted. Not yet enforced at login; see the note below.",
  "admin.agency.suspend.confirm_title":
    "This suspends {name}, {users} users and {promoters} promoters",
  "admin.agency.suspend.submit": "Suspend",
  "admin.agency.suspend.cancel": "Cancel",
  "admin.agency.unsuspend.title": "Unsuspend agency",
  "admin.agency.unsuspend.submit": "Unsuspend",
  "admin.agency.deletion.title": "Data-deletion request",
  "admin.agency.deletion.body":
    "This only marks the request. Deletion itself is Gate 1 work — a two-step, export-first erasure flow (build-plan.md §11, item G3) — and is deliberately not built here.",
  "admin.agency.deletion.mark_submit": "Mark deletion requested",
  "admin.agency.deletion.clear_submit": "Clear deletion request",
  "admin.agency.deletion.marked_badge": "Deletion requested {when}",
  "admin.agency.enforcement_note":
    "Suspension is a visible, audited flag only — the login and session layer does not check it yet. See docs/status/P18.md for the request to Lane A.",

  "admin.errors.reason_required": "Type a reason of at least 10 characters before continuing.",
  "admin.errors.agency_not_found": "That agency could not be found.",
  "admin.errors.invalid_days": "Enter a number of days between 1 and 365.",
  "admin.errors.invalid_plan": "Choose a valid plan.",
  "admin.errors.already_suspended": "This agency is already suspended.",
  "admin.errors.not_suspended": "This agency is not suspended.",
  "admin.errors.unknown": "That did not go through. Reload the page and try again.",

  "admin.plan.starter": "Starter",
  "admin.plan.agency": "Agency",
  "admin.plan.multi_brand": "Multi-brand",
  "admin.status.trialing": "Trialing",
  "admin.status.active": "Active",
  "admin.status.past_due": "Payment due",
  "admin.status.canceled": "Cancelled",
  "admin.status.paused": "Paused",

  "admin.audit.title": "Audit log",
  "admin.audit.subtitle":
    "Every admin action against customer data. Append-only — nothing here can be edited or deleted.",
  "admin.audit.filter.admin_label": "Admin",
  "admin.audit.filter.admin_all": "All admins",
  "admin.audit.filter.agency_label": "Agency",
  "admin.audit.filter.agency_all": "All agencies",
  "admin.audit.filter.from_label": "From",
  "admin.audit.filter.to_label": "To",
  "admin.audit.filter.apply": "Filter",
  "admin.audit.filter.clear": "Clear filters",
  "admin.audit.col.when": "When",
  "admin.audit.col.admin": "Admin",
  "admin.audit.col.action": "Action",
  "admin.audit.col.agency": "Agency",
  "admin.audit.col.target": "Target",
  "admin.audit.col.reason": "Reason",
  "admin.audit.empty_title": "No matching audit entries",
  "admin.audit.empty_body": "Try widening the filters.",

  "admin.waitlist.title": "Waitlist",
  "admin.waitlist.subtitle": "Product leads from the public landing page. Read-only.",
  "admin.waitlist.total": "{count} total signups",
  "admin.waitlist.by_size_title": "By promoter count",
  "admin.waitlist.by_source_title": "By UTM source",
  "admin.waitlist.recent_title": "Recent signups",
  "admin.waitlist.col.name": "Name",
  "admin.waitlist.col.email": "Email",
  "admin.waitlist.col.company": "Company",
  "admin.waitlist.col.size": "Promoters",
  "admin.waitlist.col.source": "Source",
  "admin.waitlist.col.when": "When",
  "admin.waitlist.empty_title": "No signups yet",
  "admin.waitlist.unknown_source": "Direct / unknown",

  // --- P22 — wiring the enforcement (suspension, billing read-only, promoter limit) ----------
  "enforcement.suspended.title": "This agency has been suspended",
  "enforcement.suspended.body":
    "Access to this account has been paused by PromoterOS. Nothing in the agency's data has been deleted. Contact your agency owner or our support team for details.",
  "enforcement.suspended.signout": "Sign out",

  "enforcement.banner.billing_cta": "Billing",
  "enforcement.banner.dismiss": "Dismiss",

  "enforcement.settings.agency_note": "Changing plan happens from Billing, below.",
  "enforcement.settings.billing_title": "Billing",
  "enforcement.settings.billing_body_owner":
    "See the plan, usage and invoices, or change the subscription.",
  "enforcement.settings.billing_body_staff":
    "Billing is only visible to the agency owner.",
  "enforcement.settings.billing_cta": "Open billing",

  "enforcement.promoters.blocked_read_only":
    "This account is read-only right now, so you can't add a new promoter. Go to Billing in Settings to continue.",
  "enforcement.promoters.blocked_limit":
    "You've reached the {plan} plan limit ({limit} promoters). Upgrade from Billing in Settings to add another.",

  // --- P24 — write guards on the remaining server actions (shifts, campaigns, team, invitations) ---
  "enforcement.invitations.blocked_read_only":
    "This account is read-only right now, so you can't send new invitations. Go to Billing in Settings to continue.",
  "enforcement.campaigns.blocked_read_only_create":
    "This account is read-only right now, so you can't create a new campaign. Go to Billing in Settings to continue.",
  "enforcement.campaigns.blocked_read_only_brief":
    "This account is read-only right now, so you can't save the brief. Go to Billing in Settings to continue.",
  "enforcement.campaigns.blocked_read_only_shifts":
    "This account is read-only right now, so you can't add new shifts. Go to Billing in Settings to continue.",
  "enforcement.team.blocked_read_only":
    "This account is read-only right now, so you can't invite or change a colleague's role. Go to Billing in Settings to continue.",
  "enforcement.team.blocked_seat_limit":
    "You've reached the {plan} plan's seat limit ({limit} users). Upgrade from Billing in Settings to invite another.",

  // --- P28 — the exception dashboard ---------------------------------------------------------
  "dashboard.title": "Today",
  "dashboard.subtitle": "{date} · What needs you right now.",
  "dashboard.all_shifts": "All shifts",

  "dashboard.exceptions.title": "Needs attention",
  "dashboard.severity.critical": "Urgent",
  "dashboard.severity.warning": "Worth a look",
  "dashboard.severity.info": "For information",
  "dashboard.standing_for": "True for {duration}",

  "dashboard.empty.title": "Nothing needs you",
  "dashboard.empty.body":
    "No shift needs your attention right now. Pending invitations still have time, every shift that has started has a check-in, and no field report is missing.",
  "dashboard.empty.hint": "This check covers shifts from {from} to {to}.",
  "dashboard.empty.no_shifts.title": "No shifts yet",
  "dashboard.empty.no_shifts.body":
    "Once you create a campaign with shifts, this screen shows only what needs your attention — nothing else.",
  "dashboard.empty.no_shifts.cta": "Create a campaign",

  "dashboard.today.title": "Today at a glance",
  "dashboard.today.shifts": "Shifts today",
  "dashboard.today.coverage": "Coverage",
  "dashboard.today.checked_in": "Checked in",
  "dashboard.today.of": "{done} of {total}",
  "dashboard.today.none": "No shifts today.",

  "dashboard.when.now": "now",
  "dashboard.when.in_minute": "in 1 minute",
  "dashboard.when.in_minutes": "in {n} minutes",
  "dashboard.when.in_hour": "in 1 hour",
  "dashboard.when.in_hours": "in {n} hours",
  "dashboard.when.in_day": "in 1 day",
  "dashboard.when.in_days": "in {n} days",
  "dashboard.when.ago_minute": "1 minute ago",
  "dashboard.when.ago_minutes": "{n} minutes ago",
  "dashboard.when.ago_hour": "1 hour ago",
  "dashboard.when.ago_hours": "{n} hours ago",
  "dashboard.when.ago_day": "1 day ago",
  "dashboard.when.ago_days": "{n} days ago",

  "dashboard.duration.minute": "1 minute",
  "dashboard.duration.minutes": "{n} minutes",
  "dashboard.duration.hour": "1 hour",
  "dashboard.duration.hours": "{n} hours",
  "dashboard.duration.day": "1 day",
  "dashboard.duration.days": "{n} days",

  "dashboard.ex.under_covered_one": "The shift at {store} starts {when} and is one person short.",
  "dashboard.ex.under_covered_many": "The shift at {store} starts {when} and is {missing} people short.",
  "dashboard.ex.under_covered_started_one":
    "The shift at {store} started {when} and is one person short.",
  "dashboard.ex.under_covered_started_many":
    "The shift at {store} started {when} and is {missing} people short.",
  "dashboard.ex.invitation_expiring":
    "{promoter} has not replied about the shift at {store} and the invitation expires {when}.",
  "dashboard.ex.invitation_expired":
    "{promoter}'s invitation for the shift at {store} expired {when} with no reply.",
  "dashboard.ex.declined":
    "{promoter} declined the shift at {store} {when} and the shift is still short.",
  "dashboard.ex.cancelled":
    "{promoter} cancelled the shift at {store} {when} and needs replacing.",
  "dashboard.ex.no_check_in":
    "The shift at {store} started {when} and {promoter} has not checked in.",
  "dashboard.ex.outside_geofence":
    "{promoter} checked in {distance} metres away from the store at {store}.",
  "dashboard.ex.outside_geofence_unknown":
    "{promoter} checked in outside the store area at {store}.",
  "dashboard.ex.manual_override":
    "{promoter} confirmed arrival manually at {store} — not a problem, just not confirmed by location.",
  "dashboard.ex.missing_report":
    "The shift at {store} finished {when} and {promoter} has not sent a field report.",

  "dashboard.action.open_shift": "Open shift",
  "dashboard.action.find_replacement": "Find a replacement",
  "dashboard.action.chase_reply": "Check the invitation",
  "dashboard.action.review_check_in": "Review check-in",
  "dashboard.action.request_report": "Check the report",

  // --- P32 · Promoter privacy notice (/privacy/promoters) ------------------------------------
  // Written to be read once, on a phone, standing in a supermarket.
  // No consent anywhere: see docs/decisions.md D5.
  "promoter_privacy.link": "Your personal data",
  "promoter_privacy.title": "Your personal data",
  "promoter_privacy.intro":
    "This page says what {agency} holds about you, why it holds it, and what you can ask for. No legalese, one read.",

  "promoter_privacy.controller_title": "Who is responsible",
  "promoter_privacy.controller_body":
    "The data controller is {agency} ({agencyLegal}) — the agency that invites you to shifts. It decides what is held about you and for how long.\n{processor} is only the software: it processes your data on {agency}'s behalf and on its instructions, never for its own purposes, and never shares it with another agency.\nFor anything about your data, write to {agencyEmail}.",

  "promoter_privacy.data_title": "What we hold",
  "promoter_privacy.data_body":
    "• Your name, phone number and email.\n• The areas you are willing to work in, and whether you have a car or a licence.\n• The skills you have told us about.\n• Your availability — which days and hours you can work.\n• Your work history: which invitations you received, what you answered, which shifts you covered, which were cancelled.\n• The time you confirmed arrival, and how many metres you were from the store at that moment.\n• The field reports and photos you send after a shift.",

  "promoter_privacy.not_held_title": "What we do not hold",
  "promoter_privacy.not_held_body":
    "We hold no location trail. None.\nWhen you tap \"I have arrived\", your phone gives us your position once, at that exact moment. We work out how many metres you are from the store and the position is discarded immediately. It is stored nowhere — the check-in table does not even have columns for coordinates.\nWe do not track you in the background, on shift or off it. We do not read your messages. We hold no ID document, tax number or bank details — payroll does not go through this system. And your details never go to another agency.\nIf location does not work, or you would rather not give it, you confirm arrival manually. Location is never the reason you do not get paid.",

  "promoter_privacy.purpose_title": "Why we hold it",
  "promoter_privacy.purpose_body":
    "So {agency} can offer you shifts that actually suit you — near you, at hours you can work, doing work you know. So it can send you the invitation and keep your answer. So it knows who is covering each shift and can find a replacement if someone drops out. So it can confirm the shift happened and put the client's report together.",

  "promoter_privacy.basis_title": "On what basis",
  "promoter_privacy.basis_body":
    "Two legal bases, and neither of them is your consent.\n• Performance of our agreement with you: without your phone number and your availability there is no way to offer you a shift.\n• The agency's legitimate interest: covering the shifts it has taken on, knowing who was there, and delivering an accurate report to the client.\nWe do not ask for your consent, and that is deliberate. In a working relationship consent is not genuinely free — it is hard to say no to the person who gives you work — so it would not be a valid basis and we do not rely on it. You do have the right to object to anything based on legitimate interest.",

  "promoter_privacy.retention_title": "For how long",
  "promoter_privacy.retention_body":
    "The details that identify you are kept while you work with {agency} and for a set period after your last activity. {agency} decides that period — ask at {agencyEmail}.\nAfter it, they are deleted automatically: your profile, availability, skills, invitations and per-client history are permanently removed. What remains is only the operational trace of each shift — that it was covered and what happened there — with nothing left that leads back to you.",

  "promoter_privacy.rights_title": "What you can ask for",
  "promoter_privacy.rights_body":
    "• A copy of everything we hold about you.\n• Correction of anything that is wrong.\n• Erasure of your details.\n• Objection to processing based on legitimate interest.\n• Restriction of processing, or portability of your data.\nEmail {agencyEmail}. You get an answer within one month at the latest, and it costs you nothing. If you are not satisfied, you can complain to the Hellenic Data Protection Authority (dpa.gr).",

  "promoter_privacy.processor_note":
    "The software is provided by {processor} as data processor. To contact us directly: {processorEmail}. For erasure or a copy of your data, go to the agency first — we act only on its instructions.",

  // --- P29 · Campaign and client reporting (product-spec §11) -------------------------------
  "campaign_report.back": "← Campaign",
  "campaign_report.title": "Report: {campaign}",
  "campaign_report.export_shifts": "CSV per shift",
  "campaign_report.export_stores": "CSV per store",
  "campaign_report.generated": "Generated {at} (Athens time).",
  "campaign_report.of": "{done} of {total}",

  "campaign_report.truncated.title": "This report covers only part of the campaign",
  "campaign_report.truncated.body":
    "The campaign has more rows than this page loads, so the figures do not cover the whole period. Do not send this report to a client — talk to us first.",

  "campaign_report.overview.title": "Report details",
  "campaign_report.overview.client": "Client",
  "campaign_report.overview.period": "Period",
  "campaign_report.overview.stores": "Stores ({count})",
  "campaign_report.overview.promoters": "Promoters ({count})",

  "campaign_report.basis.complete": "From all {expected} field reports.",
  "campaign_report.basis.partial": "From {arrived} of {expected} field reports — {missing} missing.",
  "campaign_report.basis.none_expected": "No field report is due yet.",
  "campaign_report.basis.field_partial":
    "{reported} of the {arrived} reports received filled this field in.",
  "campaign_report.basis.incomplete": "Partial data",

  "campaign_report.totals.title": "Field results",
  "campaign_report.totals.units": "Units promoted",
  "campaign_report.totals.sales": "Sales",
  "campaign_report.totals.interactions": "Customer interactions",

  "campaign_report.coverage.title": "Coverage",
  "campaign_report.coverage.shifts": "Shifts",
  "campaign_report.coverage.filled": "Slots filled",
  "campaign_report.coverage.completion": "Completion rate",
  "campaign_report.coverage.cancelled_shifts": "Cancelled shifts",
  "campaign_report.coverage.cancellations": "Promoter cancellations",
  "campaign_report.coverage.no_shows": "No-shows",
  "campaign_report.coverage.note":
    "A filled slot is a promoter who worked it or is booked to work it. A cancellation and a no-show do not count as filled, because the client did not get that person in that store. Cancelled shifts are left out of the denominator.",

  "campaign_report.attendance.title": "Attendance",
  "campaign_report.attendance.checked_in": "Checked in",
  "campaign_report.attendance.not_checked_in": "Not checked in",
  "campaign_report.attendance.within_geofence": "Within the store area",
  "campaign_report.attendance.outside_geofence": "Outside the area",
  "campaign_report.attendance.geofence_unknown": "No location reading",
  "campaign_report.attendance.manual_overrides": "Confirmed manually",
  "campaign_report.attendance.note":
    "Two different axes over the same check-ins: where they were, and how it was captured. Never add them together. A manual confirmation is not a fault — it exists precisely so that location never decides who gets paid.",

  "campaign_report.stores.title": "Per store",
  "campaign_report.stores.hint": "This is where an underperforming store shows up.",
  "campaign_report.stores.none": "No store has a shift yet.",
  "campaign_report.stores.col_store": "Store",
  "campaign_report.stores.col_shifts": "Shifts",
  "campaign_report.stores.col_coverage": "Coverage",
  "campaign_report.stores.col_attendance": "Checked in",
  "campaign_report.stores.col_reports": "Reports",
  "campaign_report.stores.col_units": "Units",
  "campaign_report.stores.col_sales": "Sales",
  "campaign_report.stores.col_interactions": "Interactions",
  "campaign_report.stores.col_photos": "Photos",

  "campaign_report.photos.title": "Photos",
  "campaign_report.photos.count": "{count} in total",
  "campaign_report.photos.none": "No photo has been uploaded yet.",
  "campaign_report.photos.meta": "{date} · {promoter}",
  "campaign_report.photos.alt": "Field photo from {store}, {date}",
  "campaign_report.photos.unavailable": "This photo is not available right now",

  "campaign_report.notes.title": "Notes and observations",
  "campaign_report.notes.none": "Nothing has been reported from the field yet.",
  "campaign_report.notes.meta": "{store} · {date} · {promoter}",
  "campaign_report.notes.stock_issues": "Stock issues",
  "campaign_report.notes.manager": "Store manager",

  "campaign_report.shifts.title": "Per shift",
  "campaign_report.shifts.col_date": "Date",
  "campaign_report.shifts.col_store": "Store",
  "campaign_report.shifts.col_promoters": "Promoters",
  "campaign_report.shifts.col_coverage": "Coverage",
  "campaign_report.shifts.col_reports": "Reports",
  "campaign_report.shifts.col_units": "Units",
  "campaign_report.shifts.col_photos": "Photos",

  "campaign_report.empty.title": "Nothing has come back from the field yet",
  "campaign_report.empty.body":
    "The shifts exist, but no field report and no check-in has been recorded. We do not show zeroes as if they were a result.",
  "campaign_report.empty.hint":
    "{expected} field reports are due. They will appear here as the promoters send them.",
  "campaign_report.empty.no_shifts.title": "This campaign has no shifts",
  "campaign_report.empty.no_shifts.body":
    "With no shifts there is nothing to report on. Add shifts and the report fills itself in as the campaign runs.",
  "campaign_report.empty.no_shifts.cta": "Add shifts",

  // --- P33 · Agency identity and retention (/settings/agency) --------------------------------
  "agency_settings.title": "Agency identity",
  "agency_settings.subtitle":
    "Who is the controller for your promoters' data, and how long you keep their records.",
  "agency_settings.back_to_settings": "Back to settings",
  "agency_settings.card_title": "Legal identity and retention",
  "agency_settings.card_subtitle":
    "These details appear on the personal data notice your promoters see.",
  "agency_settings.incomplete.title": "Details missing",
  "agency_settings.incomplete.body":
    "Without a legal name and a contact email, the \"Your personal data\" page cannot be shown to any promoter — they will see an error instead of the notice they are supposed to read.",
  "agency_settings.not_set": "Not set",
  "agency_settings.retention_value": "{months} months",
  "agency_settings.readonly_notice": "Only the agency's owner can change these details.",

  "agency_settings.form.legal_name.label": "Legal name (registered entity)",
  "agency_settings.form.legal_name.hint":
    "Not the name customers see — the registered legal entity, the one a promoter's erasure request is addressed to.",
  "agency_settings.form.privacy_email.label": "Privacy contact email",
  "agency_settings.form.privacy_email.hint":
    "A promoter's access or erasure request arrives here. It reaches your agency, never PromoterOS.",
  "agency_settings.form.retention.label": "Promoter record retention (months)",
  "agency_settings.form.retention.hint":
    "How long you keep a promoter's identifying record after their last activity, before it is erased automatically.",
  "agency_settings.form.retention.reasoning":
    "We suggest 24 months: promotion work is seasonal, so two cycles is the shortest window that does not throw away a usable roster.",
  "agency_settings.form.retention.not_advice":
    "This is not our legal recommendation — confirm the real number with your agency's own accountant or lawyer.",
  "agency_settings.form.submit": "Save",
  "agency_settings.form.submitting": "Saving...",
  "agency_settings.form.saved": "Saved.",

  "agency_settings.errors.not_owner": "Only the agency's owner can change these details.",
  "agency_settings.errors.legal_name_required": "Enter the agency's legal name.",
  "agency_settings.errors.legal_name_too_long": "That name is too long — 200 characters maximum.",
  "agency_settings.errors.email_required": "Enter a contact email.",
  "agency_settings.errors.email_invalid": "That email does not look right.",
  "agency_settings.errors.retention_out_of_range": "The number of months must be between 1 and 240.",
  "agency_settings.errors.write_not_permitted":
    "Saving is not currently allowed by the database. Tell the PromoterOS team — a backend change is needed before this setting can be saved.",
  "agency_settings.errors.unknown": "The save did not go through. Reload the page and try again.",

  "settings.card.identity_title": "Agency identity",
  "settings.card.identity_body":
    "The legal name, contact email and retention period your promoters see on the personal data notice.",
  "settings.card.identity_missing": "Details missing — the personal data notice cannot be shown yet.",
  "settings.card.identity_cta": "Fill in details",

  "onboarding.identity.title": "Fill in your agency's identity",
  "onboarding.identity.body":
    "Without a legal name and a contact email, the personal data notice your promoters are supposed to see cannot be shown. You can do this now or later.",
  "onboarding.identity.cta": "Agency identity",

  // P30 — the promoter declares her own availability (/a/[token]).
  "promoter_availability.title": "Your availability",
  "promoter_availability.hello": "Hi {name}.",
  "promoter_availability.intro":
    "Pick the days you can work over the next two weeks. Every choice saves straight away — there is no button at the bottom.",
  "promoter_availability.timezone_note": "All times are Greek time ({tz}).",
  "promoter_availability.footer": "Open this link again whenever your month changes.",
  "promoter_availability.saving": "Saving…",
  "promoter_availability.saved": "Saved",

  "promoter_availability.choice.available": "I can",
  "promoter_availability.choice.partial": "Hours",
  "promoter_availability.choice.unavailable": "I can't",
  "promoter_availability.choice.clear": "Clear this day",

  "promoter_availability.partial.from": "From",
  "promoter_availability.partial.to": "Until",
  "promoter_availability.partial.end_of_day": "End of day",
  "promoter_availability.partial.apply": "Save these hours",

  "promoter_availability.summary.not_set": "Not set",
  "promoter_availability.summary.available": "Available all day",
  "promoter_availability.summary.unavailable": "Not available",
  "promoter_availability.summary.available_from": "Available from {from}",
  "promoter_availability.summary.available_range": "Available {from}–{to}",
  "promoter_availability.summary.unavailable_from": "Not available from {from}",
  "promoter_availability.summary.unavailable_range": "Not available {from}–{to}",

  "promoter_availability.source.coordinator":
    "Your coordinator entered this. You can change it.",
  "promoter_availability.source.contradiction":
    "There are two different entries for this day. Choose again to leave just one.",

  "promoter_availability.error.title": "This link is not working",
  "promoter_availability.error.ask_coordinator":
    "Ask your coordinator to send you a new link.",
  "promoter_availability.error.expired": "This link has expired.",
  "promoter_availability.error.inactive": "This link is no longer active.",
  "promoter_availability.error.not_found": "We could not find your profile.",
  "promoter_availability.error.bad_token":
    "This link is not valid — it may have been cut short when it was copied.",
  "promoter_availability.error.unreachable":
    "We could not read your availability just now. Try again in a moment.",
  "promoter_availability.error.bad_date":
    "That date is outside the two weeks shown here.",
  "promoter_availability.error.bad_time": "Choose a valid time.",
  "promoter_availability.error.bad_range": "The end time has to be after the start time.",
  "promoter_availability.error.bad_choice": "That is not a valid choice.",
  "promoter_availability.error.save_failed": "That day was not saved. Tap again.",

  // P30 — the link, from the coordinator's side.
  "availability_link.title": "Availability link",
  "availability_link.description":
    "Send it to the promoter so she declares her own availability. It shows only her availability — nothing else from the system.",
  "availability_link.create": "Create link",
  "availability_link.creating": "Creating…",
  "availability_link.regenerate": "New link",
  "availability_link.copied": "Copied",
  "availability_link.expires": "Expires {date}",
  "availability_link.message_label": "Message to send",
  "availability_link.message.greeting": "Hi {name}!",
  "availability_link.message.body":
    "Tell us here when you can work over the next two weeks:",
  "availability_link.error.not_found": "That promoter was not found.",
  "availability_link.error.failed": "The link could not be created. Try again.",

  // P34 — the app shell. Labels for the sidebar chrome only.
  "shell.section_operations": "Operations",
  "shell.section_account": "Account",
  "shell.open_menu": "Open menu",
  "shell.close_menu": "Close menu",
  "shell.skip_to_content": "Skip to content",

  // P5 — a promoter's availability, from the coordinator's side
  // (/promoters/[id]/availability). Same fortnight and rules as promoter_availability.*
  // (/a/[token]) — see lib/availability-links.ts — but the row is stamped source: 'coordinator'.
  "promoters.availability.title": "Availability — {name}",
  "promoters.availability.subtitle":
    "The same two weeks the promoter herself sees. All times are Greek time ({tz}).",
  "promoters.availability.back_to_profile": "Back to profile",

  "promoters.availability.choice.available": "Can work",
  "promoters.availability.choice.partial": "Hours",
  "promoters.availability.choice.unavailable": "Can't work",
  "promoters.availability.choice.clear": "Clear this day",

  "promoters.availability.partial.from": "From",
  "promoters.availability.partial.to": "Until",
  "promoters.availability.partial.end_of_day": "End of day",
  "promoters.availability.partial.apply": "Save these hours",

  "promoters.availability.saving": "Saving…",
  "promoters.availability.saved": "Saved",

  "promoters.availability.source.self": "She said this herself",
  "promoters.availability.source.coordinator": "You entered this",
  "promoters.availability.source.contradiction":
    "There are two different entries for this day. Choose again to leave just one.",
  "promoters.availability.status.undeclared": "Undeclared",

  "promoters.availability.summary.not_set": "Not declared — not offered by matching",
  "promoters.availability.summary.available": "Available all day",
  "promoters.availability.summary.unavailable": "Not available",
  "promoters.availability.summary.available_from": "Available from {from}",
  "promoters.availability.summary.available_range": "Available {from}–{to}",
  "promoters.availability.summary.unavailable_from": "Not available from {from}",
  "promoters.availability.summary.unavailable_range": "Not available {from}–{to}",

  "promoters.availability.error.not_found": "That promoter was not found.",
  "promoters.availability.error.bad_date": "That date is outside the fortnight shown here.",
  "promoters.availability.error.bad_time": "Choose a valid time.",
  "promoters.availability.error.bad_range": "The end time has to be after the start time.",
  "promoters.availability.error.bad_choice": "That is not a valid choice.",
  "promoters.availability.error.save_failed": "That day was not saved. Tap again.",
  "promoters.availability.error.blocked_read_only":
    "This account is read-only right now, so availability cannot be changed.",
  "promoters.availability.error.unreachable":
    "We could not read availability just now. Try again in a moment.",

  "promoters.availability.bulk.title": "Fast entry",
  "promoters.availability.bulk.weekdays": "All weekdays",
  "promoters.availability.bulk.weekend": "This weekend",
  "promoters.availability.bulk.clear_all": "Clear the whole fortnight",
  "promoters.availability.bulk.running": "Applying…",
  "promoters.availability.bulk.done_weekdays": "Weekdays set to available.",
  "promoters.availability.bulk.done_weekend": "The weekend set to available.",
  "promoters.availability.bulk.done_clear_all": "The fortnight was cleared.",

  /* --- P31: brief acknowledgement --- */
  "invitation.brief.title": "Brief",
  "invitation.brief.confirm": "I've read it",
  "invitation.brief.acknowledged_on": "You read this on {date}.",
  "invitation.brief.error": "We could not record that. Try again.",

  "campaigns.brief.roster.title": "Who has read the brief",
  "campaigns.brief.roster.column.promoter": "Promoter",
  "campaigns.brief.roster.column.acknowledged_at": "Read on",
  "campaigns.brief.roster.pending_title": "Have not read it yet",
  "campaigns.brief.roster.acknowledged_title": "Have read it",
  "campaigns.brief.roster.empty_pending": "Everyone scheduled has read the brief.",
  "campaigns.brief.roster.empty_acknowledged": "No one has read it yet.",
  "campaigns.brief.roster.no_staff": "No promoter is scheduled on this campaign yet.",
  "campaigns.brief.roster.not_published":
    "The brief has not been published yet, so no promoter can read it.",

  "promoters.availability.bulk.clear_all_confirm": "Sure? Tap again to clear",
  "promoters.availability.bulk.clear_all_cancel": "Cancel",
  "promoters.availability.bulk.clear_all_warning":
    "All fourteen days will be cleared. This cannot be undone.",
  "promoters.availability.bulk.clear_all_warning_self":
    "Careful: some of these days the promoter declared herself. Those will be cleared too, with no undo.",

  /* --- P35b: the detail screens — badges for a raw assignment status, never printed verbatim --- */
  "promoters.profile.assignment_status.confirmed": "Confirmed",
  "promoters.profile.assignment_status.completed": "Completed",
  "promoters.profile.assignment_status.cancelled": "Cancelled",
  "promoters.profile.assignment_status.no_show": "No-show",

  /* --- P35c: forms and settings craft pass — no field/behaviour change, composition only --- */
  "promoters.new.back": "← Promoters",
  "campaigns.new.section_details": "Campaign details",

  "page_title.settings": "Settings",
  "page_title.settings_team": "Team",
  "page_title.settings_agency": "Agency details",
  "page_title.settings_billing": "Subscription",
  "page_title.onboarding": "Welcome",
  "page_title.onboarding_join": "Invitation",

  "copy.copied": "Copied",
  "copy.blocked":
    "Your browser did not allow copying. Open the page in Chrome or Safari and try again.",
  "copy.blocked_selected":
    "Your browser did not allow copying. The text is selected — press Ctrl+C, or long-press it on a phone.",
  "whatsapp.open": "Open in WhatsApp",

  /* --- P37a: shift sections on /shifts --- */
  "shifts.sections.new_button": "New section",
  "shifts.sections.new.title": "New section",
  "shifts.sections.new.name_label": "Section name",
  "shifts.sections.new.campaign_label": "Campaign",
  "shifts.sections.new.campaign_placeholder": "Choose a campaign",
  "shifts.sections.new.no_campaigns_hint": "There is no campaign yet — create one first.",
  "shifts.sections.new.submit": "Create",
  "shifts.sections.new.submitting": "Creating…",
  "shifts.sections.new.cancel": "Cancel",
  "shifts.sections.validation.campaign_required": "Choose a campaign.",
  "shifts.sections.validation.name_invalid": "Give it a name of up to 120 characters.",
  "shifts.sections.error.save_failed": "That did not save. Please try again.",
  "shifts.sections.error.blocked_read_only":
    "This account is read-only right now, so sections cannot be changed.",

  "shifts.sections.rename_button": "Rename",
  "shifts.sections.rename.name_label": "Section name",
  "shifts.sections.rename.save": "Save",
  "shifts.sections.rename.cancel": "Cancel",

  "shifts.sections.archive_button": "Archive",
  "shifts.sections.unarchive_button": "Unarchive",
  "shifts.sections.archived_badge": "Archived",

  "shifts.sections.import_badge": "Excel: {filename}",
  "shifts.sections.date_range": "{from} – {to}",
  "shifts.sections.date_range_none": "No dates set yet",
  "shifts.sections.next_shift": "Next: {date}",
  "shifts.sections.next_shift_none": "No upcoming shift",
  "shifts.sections.needs_people_one": "{count} shift still needs people",
  "shifts.sections.needs_people_many": "{count} shifts still need people",
  "shifts.sections.needs_people_none": "Fully staffed",
  "shifts.sections.add_shifts": "Add shifts",
  "shifts.sections.shifts_toggle_one": "Shift ({count})",
  "shifts.sections.shifts_toggle_many": "Shifts ({count})",
  "shifts.sections.shifts_empty": "No shifts in this section yet.",

  "shifts.sections.unsectioned_title": "No section",
  "shifts.sections.unsectioned_description": "Shifts created outside the sections above.",

  "shifts.sections.filters.client_label": "Client",
  "shifts.sections.filters.client_all": "All clients",
  "shifts.sections.filters.campaign_label": "Campaign",
  "shifts.sections.filters.campaign_all": "All campaigns",
  "shifts.sections.filters.when_label": "Time range",
  "shifts.sections.filters.when_all": "All",
  "shifts.sections.filters.when_upcoming": "Upcoming",
  "shifts.sections.filters.when_past": "Past",
  "shifts.sections.filters.show_archived": "Show archived",

  "shifts.sections.empty.title": "No sections yet",
  "shifts.sections.empty.body":
    "Create the first shift section by hand, or drop a client's Excel file onto this page to build it automatically.",
  "shifts.sections.empty.cta": "New section",
  "shifts.sections.filtered_empty.title": "No section matches these filters",
  "shifts.sections.filtered_empty.body": "Try different filters, or clear them.",
  "shifts.sections.filtered_empty.cta": "Clear filters",

  "campaigns.shifts_new.section_programme": "Section",
  "campaigns.shifts_new.programme_existing": "Existing section",
  "campaigns.shifts_new.programme_new": "New section",
  "campaigns.shifts_new.programme_select_label": "Section",
  "campaigns.shifts_new.programme_select_placeholder": "Choose a section",
  "campaigns.shifts_new.new_programme_name_label": "New section name",
  "campaigns.shifts_new.no_programmes_hint":
    "There is no section yet for this campaign — create the first one below.",
  "campaigns.validation.programme_required": "Choose a section.",
  "campaigns.validation.new_programme_name": "Give it a name of up to 120 characters.",
  "campaigns.shifts_new.error.programme_save_failed": "We could not save the new section. Please try again.",
  /* --- P39: automatic messaging — email adapter, dispatch, /settings/messaging --- */
  "page_title.settings_messaging": "Automatic messages",
  "settings.card.messaging_title": "Automatic messages",
  "settings.card.messaging_body":
    "The availability link goes out by email on its own: when you add a promoter, and to everyone on the 1st and the 15th of the month.",
  "settings.card.messaging_cta": "Sending settings",

  "messaging.email.default_subject": "A message from your agency",
  "messaging.email.default_action": "Open",
  "messaging.email.link_fallback": "If the button does not open, tap or copy this link:",
  "messaging.email.automated_note":
    "This email was sent automatically — please do not reply to it. For any change, talk to your coordinator.",
  "messaging.email.availability.subject_welcome": "Welcome — tell us when you can work",
  "messaging.email.availability.subject_periodic": "Update your availability",
  "messaging.email.availability.action": "Set my availability",
  "messaging.email.checkin.subject": "Your shift today at {start}",
  "messaging.email.checkin.action": "Check in",
  "messaging.email.invitation.subject": "A new shift for you",
  "messaging.email.invitation.action": "See the shift",

  "messaging.availability.welcome_intro": "{agency} has added you to its promoters.",
  "messaging.availability.welcome_intro_no_agency": "You have been added to the agency's promoters.",
  "messaging.availability.periodic_intro": "It is time to tell {agency} when you are available.",
  "messaging.availability.periodic_intro_no_agency": "It is time to update your availability.",
  "messaging.checkin.today": "You have a shift today: {where}, {start}–{end}.",
  "messaging.checkin.instruction": "When you arrive at the store, open this link to check in:",

  "messaging.title": "Automatic messages",
  "messaging.subtitle":
    "What goes out to promoters on its own, how the last send went, and who you still need to message yourself.",
  "messaging.back_to_settings": "← Settings",

  "messaging.migration_missing.title": "Automatic sending is not enabled in the database yet",
  "messaging.migration_missing.body":
    "The database update (0017) is missing. Until it is applied, nothing is sent or recorded automatically.",
  "messaging.not_configured.title": "Email is not configured",
  "messaging.not_configured.body":
    "Without email nothing can be sent automatically, so every promoter is in the list below to message by hand. Missing: {vars}.",

  "messaging.auto.title": "Availability link",
  "messaging.auto.description":
    "Emailed to every new promoter as soon as you add them, and again to every active promoter on the 1st and the 15th of each month.",
  "messaging.auto.state_on": "Automatic sending is on",
  "messaging.auto.state_off": "Automatic sending is off",
  "messaging.auto.turn_on": "Turn on",
  "messaging.auto.turn_off": "Turn off",
  "messaging.auto.owner_only": "Only the account owner can change this.",
  "messaging.auto.next_run": "Next automatic send: {date}.",
  "messaging.auto.next_run_off": "Nothing will be sent automatically until you turn it back on.",

  "messaging.last_run.title": "Last send",
  "messaging.last_run.scheduled": "scheduled",
  "messaging.last_run.manual": "manual",
  "messaging.last_run.sent": "Sent",
  "messaging.last_run.no_email": "No email",
  "messaging.last_run.reserved_domain": "Test email address",
  "messaging.last_run.failed": "Failed",
  "messaging.last_run.pending": "{count} still in progress — refresh the page in a moment.",
  "messaging.last_run.none": "Nothing has been sent yet.",

  "messaging.send_now.button": "Send to everyone now",
  "messaging.send_now.confirm_title": "An email will go to {count} promoters.",
  "messaging.send_now.confirm_already": "{count} already got it today and will not get it again.",
  "messaging.send_now.confirm_unreachable":
    "{count} have no email address we can send to — they are in the list below.",
  "messaging.send_now.confirm_once": "Whatever happens, nobody gets the same email twice today.",
  "messaging.send_now.confirm": "Send to {count}",
  "messaging.send_now.started":
    "Sending to {count} promoters has started. It takes about half a second per email — refresh the page shortly for the results.",
  "messaging.send_now.nobody": "No active promoter has an email address we can send to.",
  "messaging.send_now.all_sent_today": "Everyone with an email address already got it today.",
  "messaging.send_now.owner_only": "Only the account owner can send to everyone.",
  "messaging.send_now.needs_email": "Sending to everyone becomes available once email is configured.",
  "messaging.send_now.needs_migration": "Sending to everyone becomes available once the database is updated.",

  "messaging.unreachable.title": "Send these yourself",
  "messaging.unreachable.description":
    "Email cannot reach these promoters. Their link is ready — send it on WhatsApp or copy it.",
  "messaging.unreachable.description_no_email":
    "With no email configured, every promoter needs the link from you. It is ready for each of them.",
  "messaging.unreachable.none": "Every active promoter can receive the link automatically.",
  "messaging.unreachable.no_promoters": "There are no active promoters yet.",
  "messaging.unreachable.link_label": "Availability link for {name}",
  "messaging.unreachable.fix_email": "Fix email",

  "messaging.reason.email_not_configured": "No sending email",
  "messaging.reason.no_email": "No email",
  "messaging.reason.invalid_email": "Invalid email",
  "messaging.reason.reserved_domain": "Test email — not sent",
  "messaging.reason.last_send_failed": "Last send failed",

  "messaging.errors.not_owner": "Only the account owner can do this.",
  "messaging.errors.migration_missing":
    "The database has not been updated for automatic sending yet (0017). Nothing was sent.",
  "messaging.errors.email_not_configured": "Email is not configured, so nothing was sent.",
  "messaging.errors.write_not_permitted":
    "The database did not allow the change. If you are the owner, update 0017 has probably not been applied.",
  "messaging.errors.unknown": "That did not work. Refresh the page and try again.",

  /* --- P38: "Send invitation" from a promoter's own card, to any shift --- */
  "promoters.profile.invite_button": "Send invitation",

  "invite_panel.title": "Send invitation",
  "invite_panel.subtitle": "Choose a shift for {name}.",
  "invite_panel.filter.campaign_label": "Campaign",
  "invite_panel.filter.campaign_all": "All campaigns",
  "invite_panel.filter.date_label": "Date",
  "invite_panel.filter.clear": "Clear filters",
  "invite_panel.empty_no_shifts": "There are no upcoming shifts that need people right now.",
  "invite_panel.empty_filtered": "No shift matches these filters.",
  "invite_panel.slots_needed": "{count} spots open",
  "invite_panel.send.button": "Send invitation",
  "invite_panel.send.sent": "Sent",
  "invite_panel.send.error.missing_ids": "Missing information in the form. Reload the page.",
  "invite_panel.send.error.not_found": "Not found.",
  "invite_panel.send.error.blocked_read_only":
    "This account is read-only right now, so you can't send new invitations. Go to Billing in Settings to continue.",
  "invite_panel.send.error.unknown": "Something went wrong. Try again.",

  /* The same reasons the matching engine applies as hard filters or folds into the score —
     stated explicitly here, so the coordinator overrides the engine knowingly. */
  "invite_eligibility.blocking.archived": "This promoter is archived.",
  "invite_eligibility.blocking.blocklisted": "This promoter is blocklisted.",
  "invite_eligibility.blocking.already_confirmed": "Already confirmed on this shift.",
  "invite_eligibility.blocking.pending_invitation": "Already holds an open invitation for this shift.",
  "invite_eligibility.blocking.overlapping_confirmed_shift":
    "Already confirmed on another shift that overlaps in time.",
  "invite_eligibility.blocking.shift_unavailable": "This shift no longer needs anyone.",
  "invite_eligibility.warning.no_availability_declared": "No availability declared for this day.",
  "invite_eligibility.warning.declared_unavailable":
    "Has declared unavailability covering all or part of this shift.",
  "invite_eligibility.warning.outside_travel_radius": "Outside the usual travel radius.",
  "invite_eligibility.warning.brief_not_read": "Has not read the campaign brief yet.",

  /* --- P38: the check-in link finally reaches the promoter --- */
  "invitation.next_steps.title": "What happens next",
  "invitation.next_steps.body":
    "On the day of the shift, when you arrive at the store, open this link to check in. You can come back to this page any time to find it again.",
  "invitation.next_steps.open_checkin": "Open the arrival page",
  "invitation.next_steps.error": "We could not prepare the check-in link right now. Try again later.",

  "shifts.board.checkin_link_action": "Check-in link",
  "shifts.board.checkin_link.message.greeting": "Hi {name}!",
  "shifts.board.checkin_link.message.body": "Check in when you arrive at the store:",

  "shifts.invite.delivered": "Sent by email",
  "shifts.invite.failed": "The invitation was not sent. Try again in a moment.",
};
