/**
 * Greek is the REFERENCE locale. Add every new key here first, then in `en.ts`.
 * TypeScript enforces that `en.ts` stays complete — see `index.ts`.
 */
export const el = {
  "app.name": "PromoterOS",

  "nav.campaigns": "Καμπάνιες",
  "nav.promoters": "Promoters",
  "nav.shifts": "Βάρδιες",
  "nav.settings": "Ρυθμίσεις",
  "nav.today": "Σήμερα",
  "nav.label": "Κύρια πλοήγηση",

  "common.save": "Αποθήκευση",
  "common.cancel": "Ακύρωση",
  "common.loading": "Φόρτωση…",
  "common.copy": "Αντιγραφή",
  "common.km_away": "{km} χλμ απόσταση",

  "shift.coverage": "{filled} από {required} καλυμμένες",
  "shift.status.open": "Ανοιχτή",
  "shift.status.partially_filled": "Μερικώς καλυμμένη",
  "shift.status.filled": "Καλυμμένη",

  "match.title": "Προτεινόμενοι promoters",
  "match.invite": "Πρόσκληση",
  "match.available": "Διαθέσιμη",
  "match.has_car": "Με αυτοκίνητο",
  "match.brief_completed": "Ολοκληρωμένο brief",
  "match.brand_experience": "Εμπειρία στο brand",
  "match.why_ranked": "Γιατί προτάθηκε",
  "match.none_no_promoters":
    "Δεν υπάρχει κανένας ενεργός promoter στον κατάλογο, οπότε δεν υπάρχει τίποτα να καταταχθεί.",
  "match.none_no_promoters_cta": "Πρόσθεσε promoter",
  "match.none_nobody_declared":
    "Κανένας από τους {active} ενεργούς promoters δεν έχει δηλώσει διαθεσιμότητα για τις {date}. Δεν είναι ότι δεν ταιριάζει κανείς — απλώς δεν ξέρουμε ακόμα ποιος μπορεί.",
  "match.none_nobody_declared_cta": "Στείλε σύνδεσμο διαθεσιμότητας",
  "match.none_all_excluded_one":
    "Ένα άτομο δήλωσε ότι μπορεί στις {date}, αλλά δεν είναι διαθέσιμο για αυτή τη βάρδια: είναι πολύ μακριά, αποκλεισμένο, ήδη κλεισμένο, ή του έχει ήδη σταλεί πρόσκληση.",
  "match.none_all_excluded_many":
    "{declared} άτομα δήλωσαν ότι μπορούν στις {date}, αλλά κανένα δεν είναι διαθέσιμο για αυτή τη βάρδια: είναι πολύ μακριά, αποκλεισμένα, ήδη κλεισμένα, ή τους έχει ήδη σταλεί πρόσκληση.",
  "match.none": "Κανένας διαθέσιμος promoter για αυτή τη βάρδια.",
  "match.factor.distance": "Απόσταση",
  "match.factor.brand_experience": "Εμπειρία στο brand",
  "match.factor.category_experience": "Εμπειρία σε αντίστοιχο πρόγραμμα",
  "match.factor.skill_overlap": "Κατάλληλα skills",
  "match.factor.brief_completed": "Brief",
  "match.factor.reliability": "Συνέπεια",
  "match.brand_shifts": "{count} βάρδιες για τον πελάτη",

  "shifts.title": "Βάρδιες",
  "shifts.none": "Δεν υπάρχουν βάρδιες.",
  "shifts.list.subtitle_shifts_one": "1 βάρδια",
  "shifts.list.subtitle_shifts_many": "{count} βάρδιες",
  "shifts.list.subtitle_sections_one": "σε 1 ενότητα",
  "shifts.list.subtitle_sections_many": "σε {count} ενότητες",
  "shifts.empty.title": "Καμία βάρδια ακόμα",
  "shifts.empty.body":
    "Οι βάρδιες ζουν μέσα σε μια καμπάνια. Φτιάξε την πρώτη σου καμπάνια και πρόσθεσε τις βάρδιές της.",
  "shifts.empty.cta": "Δημιουργία καμπάνιας",
  "shifts.date": "Ημερομηνία",
  "shifts.store": "Κατάστημα",
  "shifts.campaign": "Καμπάνια",
  "shifts.needed": "Άτομα",

  "invitation.title": "Νέα βάρδια",
  "invitation.question": "Είσαι διαθέσιμη;",
  "invitation.accept": "Αποδοχή",
  "invitation.decline": "Απόρριψη",
  "invitation.accepted": "Ευχαριστούμε! Η βάρδια καταχωρήθηκε.",
  "invitation.declined": "Ευχαριστούμε για την απάντηση.",
  "invitation.expired": "Η πρόσκληση έχει λήξει.",

  "checkin.title": "Άφιξη στο κατάστημα",
  "checkin.confirm": "Δήλωσε άφιξη",
  "checkin.success": "Καταγράφηκε η άφιξή σου.",
  "checkin.too_far": "Φαίνεσαι μακριά από το κατάστημα.",
  "checkin.override": "Είμαι εδώ, το GPS δεν είναι σωστό",
  "checkin.privacy":
    "Η τοποθεσία σου καταγράφεται μόνο αυτή τη στιγμή, για να επιβεβαιωθεί η άφιξη. Δεν αποθηκεύουμε τις συντεταγμένες σου ούτε σε παρακολουθούμε.",

  "landing.logo_alt": "Λογότυπο PromoterOS",
  "landing.language.el": "ΕΛ",
  "landing.language.en": "EN",
  "landing.eyebrow": "Για promotion & field-staffing agencies",
  "landing.title": "Λιγότερα τηλεφωνήματα. Καλυμμένες βάρδιες.",
  "landing.lede":
    "Το PromoterOS βρίσκει τους σωστούς promoters, οργανώνει προσκλήσεις και αλλαγές, και δίνει στην ομάδα σου καθαρή εικόνα από το πεδίο.",
  "landing.hero_note":
    "Σχεδιάζεται μαζί με agencies που θέλουν να επιστρέψουν τον χρόνο τους σε πελάτες και ανάπτυξη — όχι σε ατελείωτα μηνύματα.",
  "landing.product_label": "Ένας καθαρός τρόπος να λειτουργείς",
  "landing.product_title": "Ο coordinator βλέπει μόνο ό,τι χρειάζεται προσοχή.",
  "landing.product_lede":
    "Από την επιλογή promoter έως το check-in και το field report, κάθε campaign έχει μία αξιόπιστη εικόνα λειτουργίας.",
  "landing.benefit_1_title": "Βρες τον κατάλληλο promoter",
  "landing.benefit_1_body":
    "Προτάσεις με βάση διαθεσιμότητα, απόσταση, εμπειρία, skills, brief και αξιοπιστία — με ξεκάθαρη αιτιολόγηση.",
  "landing.benefit_2_title": "Κάλυψε ακυρώσεις γρήγορα",
  "landing.benefit_2_body":
    "Όταν μια βάρδια αλλάζει, βρίσκεις άμεσα τους κατάλληλους replacements και ξεκινάς τις προσκλήσεις από ένα σημείο.",
  "landing.benefit_3_title": "Έλεγξε το πεδίο χωρίς κυνήγι",
  "landing.benefit_3_body":
    "Check-ins, φωτογραφίες και αναφορές παραμένουν συνδεδεμένα με τη βάρδια και την καμπάνια τους.",
  "landing.footer": "PromoterOS — λειτουργία προωθητικών ενεργειών, σε τάξη.",
  "landing.privacy": "Πολιτική απορρήτου",

  "waitlist.title": "Ζήτησε early access",
  "waitlist.intro": "Γίνε από τις πρώτες agencies που θα δουν το PromoterOS.",
  "waitlist.full_name": "Ονοματεπώνυμο",
  "waitlist.work_email": "Επαγγελματικό email",
  "waitlist.company": "Εταιρεία",
  "waitlist.job_title": "Ρόλος",
  "waitlist.promoter_count": "Πόσους promoters διαχειρίζεστε;",
  "waitlist.choose_count": "Επίλεξε εύρος",
  "waitlist.count_1_30": "1–30",
  "waitlist.count_31_100": "31–100",
  "waitlist.count_101_300": "101–300",
  "waitlist.count_300_plus": "300+",
  "waitlist.challenge": "Ποια εργασία σας παίρνει σήμερα περισσότερο χρόνο; (προαιρετικό)",
  "waitlist.submit": "Εγγραφή στη waitlist",
  "waitlist.submitting": "Αποθήκευση…",
  "waitlist.privacy_note":
    "Θα χρησιμοποιήσουμε τα επαγγελματικά στοιχεία σου μόνο για να αξιολογήσουμε το ενδιαφέρον και να επικοινωνήσουμε για early access.",
  "waitlist.website": "Ιστότοπος",
  "waitlist.status.idle": "",
  "waitlist.status.success": "Ευχαριστούμε — η εγγραφή σου καταχωρήθηκε. Θα επικοινωνήσουμε όταν ανοίξει το early access.",
  "waitlist.status.already_joined": "Αυτό το email είναι ήδη στη waitlist. Σε ευχαριστούμε για το ενδιαφέρον.",
  "waitlist.status.invalid": "Έλεγξε τα υποχρεωτικά πεδία και προσπάθησε ξανά.",
  "waitlist.status.error": "Δεν μπορέσαμε να καταχωρήσουμε την εγγραφή τώρα. Δοκίμασε ξανά σε λίγο.",

  "privacy.title": "Πολιτική απορρήτου για τη waitlist",
  "privacy.intro": "Πώς χρησιμοποιούμε τα στοιχεία που δίνεις για early access στο PromoterOS.",
  "privacy.controller_title": "Υπεύθυνος επεξεργασίας",
  "privacy.controller_body": "{company} είναι υπεύθυνος για τα στοιχεία της waitlist. Για θέματα απορρήτου, επικοινώνησε στο {email}.",
  "privacy.data_title": "Στοιχεία που συλλέγουμε",
  "privacy.data_body": "Συλλέγουμε το ονοματεπώνυμο, το επαγγελματικό email, την εταιρεία, τον ρόλο, το μέγεθος της ομάδας promoters και ό,τι επιλέξεις να μοιραστείς για τις λειτουργικές σου ανάγκες.",
  "privacy.purpose_title": "Γιατί τα χρησιμοποιούμε",
  "privacy.purpose_body": "Χρησιμοποιούμε τα στοιχεία αποκλειστικά για να αξιολογήσουμε το ενδιαφέρον για το PromoterOS, να σχεδιάσουμε το προϊόν με βάση τις ανάγκες agencies και να επικοινωνήσουμε μαζί σου για early access.",
  "privacy.basis_title": "Νομική βάση",
  "privacy.basis_body": "Η επεξεργασία βασίζεται στα βήματα που ζητάς πριν από πιθανή εμπορική συνεργασία και στο έννομο συμφέρον μας να αξιολογούμε τη ζήτηση και να αναπτύσσουμε υπεύθυνα το προϊόν. Δεν χρησιμοποιούμε checkbox συγκατάθεσης ως νομική βάση.",
  "privacy.retention_title": "Χρόνος διατήρησης",
  "privacy.retention_body": "Διατηρούμε τα στοιχεία για έως 12 μήνες από την εγγραφή, εκτός αν ξεκινήσει εμπορική συνεργασία ή ζητήσεις νωρίτερα διαγραφή.",
  "privacy.rights_title": "Τα δικαιώματά σου",
  "privacy.rights_body": "Μπορείς να ζητήσεις πρόσβαση, διόρθωση, διαγραφή ή περιορισμό της επεξεργασίας των στοιχείων σου, επικοινωνώντας στο email παραπάνω.",
  "privacy.back": "Επιστροφή στη waitlist",

  "auth.login_title": "Σύνδεση",
  "auth.login_intro": "Θα σου στείλουμε έναν σύνδεσμο μιας χρήσης στο email σου. Δεν χρειάζεται κωδικός.",
  "auth.email_label": "Επαγγελματικό email",
  "auth.email_placeholder": "onoma@agency.gr",
  "auth.send_link": "Στείλε μου σύνδεσμο",
  "auth.sending": "Αποστολή…",
  "auth.link_sent": "Αν η διεύθυνση έχει πρόσβαση, ο σύνδεσμος στάλθηκε. Άνοιξέ τον από την ίδια συσκευή.",
  "auth.link_failed": "Ο σύνδεσμος έληξε ή έχει ήδη χρησιμοποιηθεί. Ζήτησε καινούριο.",

  // Η σελίδα που βλέπει κάποιος όταν χτυπήσει το όριο αιτήσεων στο middleware. Γραμμένη για
  // promoter: δεν φταίει αυτός και ο σύνδεσμός του εξακολουθεί να ισχύει.
  "rate_limit.title": "Πάρα πολλές αιτήσεις",
  "rate_limit.body":
    "Δοκίμασε ξανά σε λίγο. Αν άνοιξες τον σύνδεσμό σου πολλές φορές στη σειρά, περίμενε ένα λεπτό και ξαναπροσπάθησε — ο σύνδεσμος εξακολουθεί να ισχύει.",
  "auth.error_invalid_email": "Δώσε μια έγκυρη διεύθυνση email.",
  "auth.error_rate_limited": "Έγιναν πολλές προσπάθειες. Δοκίμασε ξανά σε λίγα λεπτά.",
  "auth.error_generic": "Δεν μπορέσαμε να στείλουμε τον σύνδεσμο τώρα. Δοκίμασε ξανά.",
  "auth.no_agency_title": "Ο λογαριασμός δεν ανήκει ακόμη σε agency",
  "auth.no_agency_body": "Η σύνδεση πέτυχε, αλλά αυτή η διεύθυνση δεν έχει αντιστοιχιστεί σε agency, οπότε δεν βλέπεις κανένα δεδομένο. Ζήτησε από τον διαχειριστή να σου δώσει πρόσβαση.",
  "auth.signed_in_as": "Σύνδεση ως {email}",
  "auth.sign_out": "Αποσύνδεση",
  "auth.completing": "Σε συνδέουμε…",
  "auth.code_label": "Ή βάλε τον κωδικό από το email",
  "auth.code_hint":
    "Εξαψήφιος κωδικός. Δούλεψε ακόμα κι αν ο σύνδεσμος δεν άνοιξε — μερικοί πάροχοι email τον «καταναλώνουν» ελέγχοντάς τον.",
  "auth.code_submit": "Σύνδεση με κωδικό",
  "auth.code_checking": "Έλεγχος…",
  "auth.code_invalid": "Ο κωδικός δεν είναι σωστός ή έληξε. Ζήτησε καινούριο.",
  "auth.create_agency_cta": "Δημιούργησε την εταιρεία σου",
  "auth.invitation_waiting_title": "Σε περιμένει μια πρόσκληση",
  "auth.invitation_waiting_body":
    "Το «{agency}» σε κάλεσε στην ομάδα του ως {role}. Μέχρι να την αποδεχτείς, ο λογαριασμός σου δεν βλέπει δεδομένα.",
  "auth.invitation_waiting_how":
    "Άνοιξε τον σύνδεσμο της πρόσκλησης από το email που στάλθηκε στο {email}. Ο σύνδεσμος είναι μοναδικός και δεν μπορούμε να τον ξαναφτιάξουμε εδώ — αν δεν τον βρίσκεις, ζήτησε από τον ιδιοκτήτη να τον στείλει ξανά.",
  "auth.invitation_waiting_other": "Ήθελες να φτιάξεις δικό σου πρακτορείο;",

  "promoters.add": "Προσθήκη promoter",
  "promoters.value_yes": "Ναι",
  "promoters.value_no": "Όχι",
  "promoters.missing_coordinates": "Χωρίς συντεταγμένες",

  "promoters.new.title": "Νέος promoter",
  "promoters.new.subtitle": "Καταχώρισε τα στοιχεία του — η διεύθυνση χρειάζεται μόνο για να βρεθούν οι συντεταγμένες.",
  "promoters.edit.title": "Επεξεργασία — {name}",
  "promoters.edit.archive_section_title": "Αρχειοθέτηση",
  "promoters.edit.archive_description":
    "Ένας αρχειοθετημένος promoter δεν προτείνεται πια σε νέες βάρδιες, αλλά το ιστορικό του παραμένει. Δεν διαγράφεται ποτέ.",
  "promoters.edit.archive_button": "Αρχειοθέτηση promoter",
  "promoters.edit.archive_confirm_prompt": "Είσαι σίγουρη/-ος ότι θέλεις να αρχειοθετήσεις αυτόν τον promoter;",
  "promoters.edit.archive_confirm_yes": "Ναι, αρχειοθέτηση",
  "promoters.edit.archive_confirm_cancel": "Άκυρο",
  "promoters.edit.archived_notice": "Αυτός ο promoter είναι αρχειοθετημένος. Άλλαξε την κατάσταση παραπάνω σε \"Ενεργός\" για να τον επαναφέρεις.",

  "promoters.list.subtitle_one": "1 promoter",
  "promoters.list.subtitle_many": "{count} promoters",
  "promoters.list.low_count_hint":
    "Η κατάταξη βγάζει νόημα μόνο με μια χούφτα promoters — πρόσθεσε τουλάχιστον 5-8 σε διαφορετικές περιοχές πριν δοκιμάσεις μια βάρδια.",

  "promoters.filter.search_label": "Αναζήτηση",
  "promoters.filter.search_placeholder": "Όνομα ή τηλέφωνο",
  "promoters.filter.status_label": "Κατάσταση",
  "promoters.filter.all_statuses": "Όλες οι καταστάσεις",
  "promoters.filter.area_label": "Περιοχή",
  "promoters.filter.all_areas": "Όλες οι περιοχές",
  "promoters.filter.skill_label": "Δεξιότητα",
  "promoters.filter.all_skills": "Όλες οι δεξιότητες",
  "promoters.filter.car_label": "Αυτοκίνητο",
  "promoters.filter.car_any": "Όλοι",
  "promoters.filter.car_yes": "Με αυτοκίνητο",
  "promoters.filter.car_no": "Χωρίς αυτοκίνητο",
  "promoters.filter.apply": "Φίλτρο",
  "promoters.filter.clear": "Καθαρισμός φίλτρων",
  "promoters.filter.result_count": "{shown} από {total}",
  "promoters.page.nav_label": "Σελίδες καταλόγου",
  "promoters.page.range": "{from}–{to} από {total}",
  "promoters.page.of": "Σελίδα {page} από {pages}",
  "promoters.page.prev": "Προηγούμενη",
  "promoters.page.next": "Επόμενη",

  "promoters.empty.title": "Δεν υπάρχουν promoters ακόμη",
  "promoters.empty.description":
    "Πρόσθεσε τους πρώτους promoters — χρειάζεσαι τουλάχιστον 5-8, σε διαφορετικές περιοχές και με διαφορετικά μέσα μετακίνησης και δεξιότητες, πριν η κατάταξη μιας βάρδιας βγάζει νόημα.",
  "promoters.empty_filtered.title": "Κανένα αποτέλεσμα",
  "promoters.empty_filtered.description": "Κανένας promoter δεν ταιριάζει με αυτά τα φίλτρα. Δοκίμασε να τα αλλάξεις ή καθάρισέ τα.",

  "promoters.table.name": "Όνομα",
  "promoters.table.phone": "Τηλέφωνο",
  "promoters.table.areas": "Περιοχές",
  "promoters.table.transport": "Μετακίνηση",
  "promoters.table.skills": "Δεξιότητες",
  "promoters.table.reliability": "Συνέπεια",
  "promoters.table.status": "Κατάσταση",
  "promoters.table.reliability_aria": "Συνέπεια για {name}",

  "promoters.status.active": "Ενεργός",
  "promoters.status.paused": "Σε παύση",
  "promoters.status.archived": "Αρχειοθετημένος",
  "promoters.status.blocklisted": "Σε αποκλεισμό",

  "promoters.errors.full_name_required": "Συμπλήρωσε το ονοματεπώνυμο.",
  "promoters.errors.email_invalid": "Δώσε ένα έγκυρο email ή άφησε το πεδίο κενό.",
  "promoters.errors.birth_year_invalid": "Δώσε ένα έγκυρο έτος γέννησης.",
  "promoters.errors.coordinates_invalid": "Οι συντεταγμένες δεν είναι έγκυρες.",
  "promoters.errors.coordinates_incomplete": "Συμπλήρωσε και τα δύο πεδία συντεταγμένων.",
  "promoters.errors.phone_required": "Δώσε ένα τηλέφωνο (τουλάχιστον 6 ψηφία).",
  "promoters.errors.save_failed": "Δεν μπορέσαμε να αποθηκεύσουμε τον promoter. Δοκίμασε ξανά.",
  "promoters.errors.not_found": "Αυτός ο promoter δεν βρέθηκε.",
  "promoters.errors.duplicate_phone": "Υπάρχει ήδη promoter με αυτό το τηλέφωνο.",
  "promoters.errors.duplicate_phone_link": "Προβολή promoter",

  "promoters.form.section_basics": "Βασικά στοιχεία",
  "promoters.form.full_name": "Ονοματεπώνυμο",
  "promoters.form.phone": "Τηλέφωνο",
  "promoters.form.phone_hint": "π.χ. 6971234567 ή +30 697 123 4567",
  "promoters.form.email": "Email",
  "promoters.form.birth_year": "Έτος γέννησης",
  "promoters.form.section_address": "Διεύθυνση & τοποθεσία",
  "promoters.form.address_intro":
    "Η διεύθυνση χρησιμοποιείται μόνο για να βρεθούν οι συντεταγμένες — δεν αποθηκεύεται ως κείμενο.",
  "promoters.form.address_label": "Διεύθυνση κατοικίας",
  "promoters.form.address_placeholder": "π.χ. Ερμού 12, Γλυφάδα",
  "promoters.form.geocode_button": "Εύρεση συντεταγμένων",
  "promoters.form.geocode_found": "Βρέθηκε — επιβεβαίωσε ότι η τοποθεσία παρακάτω είναι σωστή πριν αποθηκεύσεις.",
  "promoters.form.geocode_found_low":
    "Η αντιστοίχιση δεν είναι σίγουρη — έλεγξε προσεκτικά τις συντεταγμένες παρακάτω πριν αποθηκεύσεις.",
  "promoters.form.geocode_not_found":
    "Δεν μπορέσαμε να εντοπίσουμε αυτόματα αυτή τη διεύθυνση — συνηθισμένο με ελληνικές διευθύνσεις. Καταχώρισε τις συντεταγμένες χειροκίνητα παρακάτω, ή αποθήκευσε τον promoter χωρίς αυτές προς το παρόν.",
  "promoters.form.lat_label": "Γεωγραφικό πλάτος",
  "promoters.form.lng_label": "Γεωγραφικό μήκος",
  "promoters.form.manual_coords_hint": "Μπορείς πάντα να τα διορθώσεις χειροκίνητα, ακόμη κι αν βρέθηκαν αυτόματα.",
  "promoters.form.section_transport": "Μετακίνηση",
  "promoters.form.has_car_label": "Έχει αυτοκίνητο",
  "promoters.form.has_licence_label": "Έχει δίπλωμα",
  "promoters.form.transport_notes_label": "Σημειώσεις μετακίνησης",
  "promoters.form.section_areas": "Περιοχές εργασίας",
  "promoters.form.areas_hint": "Σε ποιες περιοχές είναι διατεθειμένος/-η να δουλέψει.",
  "promoters.form.no_areas_configured": "Δεν έχουν οριστεί περιοχές για αυτό το agency ακόμη.",
  "promoters.form.section_skills": "Δεξιότητες",
  "promoters.form.no_skills_configured": "Δεν έχουν οριστεί δεξιότητες για αυτό το agency ακόμη.",
  "promoters.form.level_label": "Επίπεδο",
  "promoters.form.level_1": "Βασικό",
  "promoters.form.level_2": "Καλό",
  "promoters.form.level_3": "Άριστο",
  "promoters.form.status_label": "Κατάσταση",
  "promoters.form.reactivate_hint": "Επίλεξε \"Ενεργός\" παραπάνω για να τον επαναφέρεις.",
  "promoters.form.save_new": "Αποθήκευση promoter",
  "promoters.form.save_changes": "Αποθήκευση αλλαγών",

  "promoters.profile.edit_button": "Επεξεργασία",
  "promoters.profile.availability_button": "Διαθεσιμότητα",
  "promoters.profile.missing_coordinates_banner":
    "Αυτός ο promoter δεν έχει συντεταγμένες, οπότε δεν κατατάσσεται σωστά βάσει απόστασης.",
  "promoters.profile.details_title": "Στοιχεία",
  "promoters.profile.reliability_label": "Συνέπεια",
  "promoters.profile.areas_title": "Περιοχές εργασίας",
  "promoters.profile.no_areas": "Δεν έχουν οριστεί περιοχές.",
  "promoters.profile.skills_title": "Δεξιότητες",
  "promoters.profile.no_skills": "Δεν έχουν οριστεί δεξιότητες.",
  "promoters.profile.client_history_title": "Ιστορικό πελατών",
  "promoters.profile.client_history_empty": "Δεν υπάρχει ακόμη ιστορικό με πελάτες.",
  "promoters.profile.table.client": "Πελάτης",
  "promoters.profile.table.shifts_completed": "Βάρδιες",
  "promoters.profile.table.last_worked": "Τελευταία φορά",
  "promoters.profile.table.avg_rating": "Μ.Ο. αξιολόγησης",
  "promoters.profile.upcoming_shifts_title": "Επόμενες βάρδιες",
  "promoters.profile.upcoming_empty": "Δεν υπάρχουν προγραμματισμένες βάρδιες.",
  "promoters.profile.table.assignment_status": "Κατάσταση",
  "promoters.profile.past_shifts_title": "Προηγούμενες βάρδιες",
  "promoters.profile.past_empty": "Δεν υπάρχουν προηγούμενες βάρδιες.",

  "campaigns.status.draft": "Πρόχειρη",
  "campaigns.status.active": "Ενεργή",
  "campaigns.status.completed": "Ολοκληρωμένη",
  "campaigns.status.cancelled": "Ακυρωμένη",

  "campaigns.shift_status.open": "Ανοιχτή",
  "campaigns.shift_status.partially_filled": "Μερικώς καλυμμένη",
  "campaigns.shift_status.filled": "Καλυμμένη",
  "campaigns.shift_status.completed": "Ολοκληρωμένη",
  "campaigns.shift_status.cancelled": "Ακυρωμένη",

  "campaigns.weekday.mon": "Δευ",
  "campaigns.weekday.tue": "Τρί",
  "campaigns.weekday.wed": "Τετ",
  "campaigns.weekday.thu": "Πέμ",
  "campaigns.weekday.fri": "Παρ",
  "campaigns.weekday.sat": "Σάβ",
  "campaigns.weekday.sun": "Κυρ",

  "campaigns.list.title": "Καμπάνιες",
  "campaigns.list.subtitle": "Όλες οι καμπάνιες της agency, με κάλυψη βαρδιών με μια ματιά.",
  "campaigns.list.new_button": "Νέα καμπάνια",
  "campaigns.list.empty_title": "Δεν υπάρχουν καμπάνιες ακόμη",
  "campaigns.list.empty_body":
    "Μια καμπάνια συνδέει έναν πελάτη με τα καταστήματα και τις βάρδιες που χρειάζονται promoters. Δημιούργησε την πρώτη για να ξεκινήσεις να προσκαλείς.",
  "campaigns.list.col_name": "Καμπάνια",
  "campaigns.list.col_client": "Πελάτης",
  "campaigns.list.col_dates": "Διάρκεια",
  "campaigns.list.col_status": "Κατάσταση",
  "campaigns.list.col_shifts": "Βάρδιες",
  "campaigns.list.col_coverage": "Κάλυψη",
  "campaigns.list.shift_count": "{count} βάρδιες",

  "campaigns.new.title": "Νέα καμπάνια",
  "campaigns.new.subtitle": "Πελάτης, ημερομηνίες, αμοιβή και τα skills που χρειάζεται.",
  "campaigns.new.section_client": "Πελάτης",
  "campaigns.new.client_existing": "Υπάρχων πελάτης",
  "campaigns.new.client_new": "Νέος πελάτης",
  "campaigns.new.client_select_label": "Πελάτης",
  "campaigns.new.client_select_placeholder": "Επίλεξε πελάτη",
  "campaigns.new.new_client_name_label": "Όνομα νέου πελάτη",
  "campaigns.new.no_clients_hint": "Δεν υπάρχουν ακόμη πελάτες σε αυτή την agency — πρόσθεσε τον πρώτο παρακάτω.",
  "campaigns.new.name_label": "Όνομα καμπάνιας",
  "campaigns.new.type_label": "Τύπος καμπάνιας",
  "campaigns.new.type_hint": "π.χ. δειγματισμός, ενεργοποίηση brand, roadshow",
  "campaigns.new.starts_on_label": "Ημερομηνία έναρξης",
  "campaigns.new.ends_on_label": "Ημερομηνία λήξης",
  "campaigns.new.dress_code_label": "Dress code",
  "campaigns.new.rate_label": "Ωριαία αμοιβή (EUR)",
  "campaigns.new.rate_hint": "π.χ. 4,50",
  "campaigns.new.skills_label": "Skills που ζητά η καμπάνια",
  "campaigns.new.skills_hint": "Χρησιμοποιούνται στην αντιστοίχιση promoters — επίλεξε όσα ταιριάζουν.",
  "campaigns.new.skills_none": "Δεν υπάρχουν ακόμη skills καταχωρημένα σε αυτή την agency.",
  "campaigns.new.submit": "Δημιουργία καμπάνιας",
  "campaigns.new.submitting": "Δημιουργία…",
  "campaigns.new.error.client_save_failed": "Δεν μπορέσαμε να αποθηκεύσουμε τον νέο πελάτη. Δοκίμασε ξανά.",
  "campaigns.new.error.save_failed": "Δεν μπορέσαμε να αποθηκεύσουμε την καμπάνια. Δοκίμασε ξανά.",

  "campaigns.detail.back": "← Καμπάνιες",
  "campaigns.detail.overview_title": "Στοιχεία καμπάνιας",
  "campaigns.detail.dates_label": "Διάρκεια",
  "campaigns.detail.status_label": "Κατάσταση",
  "campaigns.detail.rate_label": "Ωριαία αμοιβή",
  "campaigns.detail.dress_code_label": "Dress code",
  "campaigns.detail.brief_title": "Brief",
  "campaigns.detail.brief_none": "Δεν έχει γραφτεί brief ακόμη.",
  "campaigns.detail.brief_published": "Δημοσιευμένο",
  "campaigns.detail.brief_draft": "Πρόχειρο — δεν έχει δημοσιευτεί ακόμη",
  "campaigns.detail.brief_edit": "Επεξεργασία brief",
  "campaigns.detail.brief_write": "Γράψε brief",
  "campaigns.detail.stores_title": "Καταστήματα",
  "campaigns.detail.stores_none": "Δεν έχουν προστεθεί καταστήματα ακόμη — προστίθενται μαζί με τις βάρδιες.",
  "campaigns.detail.shifts_title": "Βάρδιες",
  "campaigns.detail.shifts_none_title": "Δεν υπάρχουν βάρδιες ακόμη",
  "campaigns.detail.shifts_none_body":
    "Πρόσθεσε βάρδιες για να ξεκινήσεις να καλείς promoters — μπορείς να δημιουργήσεις πολλές μαζί.",
  "campaigns.detail.add_shifts": "Προσθήκη βαρδιών",
  "campaigns.detail.col_coverage": "Κάλυψη",
  "campaigns.detail.status_title": "Κατάσταση καμπάνιας",
  "campaigns.detail.mark_active": "Ενεργοποίηση",
  "campaigns.detail.mark_completed": "Ολοκλήρωση",
  "campaigns.detail.cancel": "Ακύρωση καμπάνιας",
  "campaigns.detail.cancel_confirm_yes": "Ναι, ακύρωση καμπάνιας",
  "campaigns.detail.cancel_confirm_no": "Άκυρο",
  "campaigns.detail.status_error.transition":
    "Η κατάσταση της καμπάνιας άλλαξε στο μεταξύ. Ανανέωσε τη σελίδα και δες πού βρίσκεται τώρα.",
  "campaigns.detail.status_error.save_failed": "Δεν αποθηκεύτηκε. Δοκίμασε ξανά.",
  "campaigns.detail.cancel_confirm":
    "Να ακυρωθεί η καμπάνια «{name}»; Οι βάρδιες θα παραμείνουν καταχωρημένες, αλλά η καμπάνια θα σημανθεί ακυρωμένη.",

  "campaigns.shifts_new.back": "← Πίσω στην καμπάνια",
  "campaigns.shifts_new.title": "Προσθήκη βαρδιών",
  "campaigns.shifts_new.subtitle": "Για την καμπάνια «{campaign}»",
  "campaigns.shifts_new.section_store": "Κατάστημα",
  "campaigns.shifts_new.store_existing": "Υπάρχον κατάστημα",
  "campaigns.shifts_new.store_new": "Νέο κατάστημα",
  "campaigns.shifts_new.store_select_label": "Κατάστημα",
  "campaigns.shifts_new.store_select_placeholder": "Επίλεξε κατάστημα",
  "campaigns.shifts_new.no_stores_hint":
    "Δεν υπάρχουν ακόμη καταστήματα για αυτόν τον πελάτη — πρόσθεσε το πρώτο παρακάτω.",
  "campaigns.shifts_new.new_store_name_label": "Όνομα καταστήματος",
  "campaigns.shifts_new.new_store_address_label": "Διεύθυνση",
  "campaigns.shifts_new.new_store_lat_label": "Γεωγραφικό πλάτος",
  "campaigns.shifts_new.new_store_lng_label": "Γεωγραφικό μήκος",
  "campaigns.shifts_new.new_store_coords_hint":
    "Μη αυτόματες συντεταγμένες προς το παρόν — βρες τις στο Google Maps. Ο αυτόματος εντοπισμός έρχεται αργότερα.",
  "campaigns.shifts_new.section_schedule": "Πρόγραμμα",
  "campaigns.shifts_new.from_date_label": "Από ημερομηνία",
  "campaigns.shifts_new.to_date_label": "Έως ημερομηνία",
  "campaigns.shifts_new.to_date_hint": "Ίδια με την «από» για μία μόνο ημέρα.",
  "campaigns.shifts_new.weekdays_label": "Ημέρες",
  "campaigns.shifts_new.start_time_label": "Ώρα έναρξης",
  "campaigns.shifts_new.end_time_label": "Ώρα λήξης",
  "campaigns.shifts_new.promoters_required_label": "Άτομα ανά βάρδια",
  "campaigns.shifts_new.rate_override_label": "Αμοιβή για αυτές τις βάρδιες (EUR, προαιρετικό)",
  "campaigns.shifts_new.rate_override_hint": "Αν μείνει κενό, ισχύει η αμοιβή της καμπάνιας.",
  "campaigns.shifts_new.preview_count": "{count} βάρδιες θα δημιουργηθούν",
  "campaigns.shifts_new.preview_none": "Επίλεξε ημερομηνίες και ημέρες για να δεις πόσες βάρδιες θα δημιουργηθούν.",
  "campaigns.shifts_new.submit": "Δημιουργία βαρδιών",
  "campaigns.shifts_new.submitting": "Δημιουργία…",
  "campaigns.shifts_new.error.store_save_failed": "Δεν μπορέσαμε να αποθηκεύσουμε το νέο κατάστημα. Δοκίμασε ξανά.",
  "campaigns.shifts_new.error.save_failed": "Δεν μπορέσαμε να αποθηκεύσουμε τις βάρδιες. Δοκίμασε ξανά.",

  "campaigns.brief.back": "← Πίσω στην καμπάνια",
  "campaigns.brief.title": "Brief καμπάνιας",
  "campaigns.brief.subtitle": "Για την καμπάνια «{campaign}»",
  "campaigns.brief.title_label": "Τίτλος",
  "campaigns.brief.body_label": "Περιεχόμενο (markdown)",
  "campaigns.brief.body_hint":
    "Υποστηρίζεται απλή μορφοποίηση markdown — οι promoters το βλέπουν μετά την πρόσκληση.",
  "campaigns.brief.default_title": "Brief — {campaign}",
  "campaigns.brief.save_draft": "Αποθήκευση πρόχειρου",
  "campaigns.brief.publish": "Δημοσίευση",
  "campaigns.brief.republish": "Επαναδημοσίευση",
  "campaigns.brief.state.published": "Δημοσιευμένο",
  "campaigns.brief.state.published_at": "Δημοσιεύτηκε {when}",
  "campaigns.brief.state.draft": "Πρόχειρο",
  "campaigns.brief.state.none": "Δεν υπάρχει brief ακόμα",
  "campaigns.brief.state.published_hint":
    "Οι promoters το διαβάζουν ήδη από τον σύνδεσμο της πρόσκλησης. Ό,τι αποθηκεύσεις εδώ το βλέπουν αμέσως.",
  "campaigns.brief.state.draft_hint":
    "Κανένας promoter δεν το βλέπει ακόμα. Πάτα «Δημοσίευση» για να το δουν.",
  "campaigns.brief.saving": "Αποθήκευση…",
  "campaigns.brief.error.save_failed": "Δεν μπορέσαμε να αποθηκεύσουμε το brief. Δοκίμασε ξανά.",

  "campaigns.validation.required": "Συμπλήρωσε αυτό το πεδίο.",
  "campaigns.validation.too_long": "Το κείμενο είναι πολύ μεγάλο.",
  "campaigns.validation.name_length": "Χρειάζεται τουλάχιστον 2 χαρακτήρες.",
  "campaigns.validation.client_required": "Επίλεξε πελάτη ή πρόσθεσε νέο.",
  "campaigns.validation.new_client_name": "Δώσε όνομα για τον νέο πελάτη (τουλάχιστον 2 χαρακτήρες).",
  "campaigns.validation.date_invalid": "Δώσε έγκυρη ημερομηνία.",
  "campaigns.validation.date_order": "Η ημερομηνία λήξης πρέπει να είναι ίδια ή μετά την έναρξη.",
  "campaigns.validation.rate_invalid": "Δώσε έγκυρο ποσό, π.χ. 4,50.",
  "campaigns.validation.store_required": "Επίλεξε κατάστημα ή πρόσθεσε νέο.",
  "campaigns.validation.new_store_name": "Δώσε όνομα για το νέο κατάστημα (τουλάχιστον 2 χαρακτήρες).",
  "campaigns.validation.coords_invalid": "Δώσε έγκυρες συντεταγμένες.",
  "campaigns.validation.time_invalid": "Δώσε έγκυρη ώρα.",
  "campaigns.validation.time_order": "Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.",
  "campaigns.validation.promoters_required": "Δώσε αριθμό ατόμων τουλάχιστον 1.",
  "campaigns.validation.weekdays_none": "Επίλεξε τουλάχιστον μία ημέρα.",
  "campaigns.validation.no_dates": "Δεν προέκυψε καμία ημερομηνία βάρδιας — έλεγξε το εύρος και τις ημέρες.",
  "campaigns.validation.campaign_not_found": "Η καμπάνια δεν βρέθηκε.",

  "checkin.expired": "Ο σύνδεσμος έχει λήξει ή δεν είναι έγκυρος.",
  "checkin.locating": "Εντοπισμός τοποθεσίας…",
  "checkin.submitting": "Αποστολή…",
  "checkin.recorded_far_note": "Το καταγράψαμε ούτως ή άλλως — ενημερώθηκε ο συντονιστής σου.",
  "checkin.go_to_report": "Συνέχεια στην αναφορά",
  "checkin.override_prompt": "Δεν μπορέσαμε να επιβεβαιώσουμε την τοποθεσία σου. Μπορείς να δηλώσεις άφιξη χειροκίνητα.",
  "checkin.override_reason_label": "Λόγος (προαιρετικό)",
  "checkin.override_reason_placeholder": "π.χ. το GPS του κινητού δεν λειτουργεί",
  "checkin.override_submit": "Δήλωσε άφιξη χειροκίνητα",
  "checkin.retry_geo": "Δοκίμασε ξανά με GPS",
  "checkin.geo_denied": "Δεν δόθηκε άδεια πρόσβασης στην τοποθεσία.",
  "checkin.geo_unavailable": "Δεν μπορέσαμε να λάβουμε την τοποθεσία σου.",
  "checkin.geo_timeout": "Ο εντοπισμός τοποθεσίας άργησε πολύ. Δοκίμασε ξανά.",
  "checkin.geo_unsupported": "Ο browser σου δεν υποστηρίζει εντοπισμό τοποθεσίας.",
  "checkin.geo_insecure": "Ο εντοπισμός τοποθεσίας χρειάζεται ασφαλή σύνδεση (HTTPS).",
  "checkin.already_checked_in_error": "Η άφιξη έχει ήδη καταγραφεί.",
  "checkin.save_failed": "Δεν μπορέσαμε να αποθηκεύσουμε την άφιξη. Δοκίμασε ξανά.",
  "checkin.brief_title": "Brief",
  "checkin.already_done": "Η άφιξη και η αναφορά έχουν ήδη καταχωρηθεί. Ευχαριστούμε!",
  "checkin.not_yet_time": "Η βάρδια δεν έχει ξεκινήσει ακόμα.",

  "report.title": "Αναφορά βάρδιας",
  "report.units_promoted_label": "Τεμάχια που προωθήθηκαν",
  "report.sales_count_label": "Πωλήσεις",
  "report.interactions_count_label": "Επαφές με πελάτες",
  "report.stock_issues_label": "Προβλήματα αποθέματος",
  "report.store_manager_name_label": "Όνομα υπεύθυνου καταστήματος",
  "report.notes_label": "Σημειώσεις",
  "report.photos_label": "Φωτογραφίες",
  "report.photos_hint": "Προαιρετικό. Μπορείς να προσθέσεις παραπάνω από μία.",
  "report.submit": "Αποθήκευση αναφοράς",
  "report.submitting": "Αποθήκευση…",
  "report.success": "Η αναφορά καταχωρήθηκε. Ευχαριστούμε!",
  "report.success_with_photo_failures": "Η αναφορά καταχωρήθηκε, αλλά κάποιες φωτογραφίες δεν ανέβηκαν. Η αναφορά είναι ήδη αποθηκευμένη.",
  "report.validation.number_invalid": "Δώσε έναν έγκυρο μη αρνητικό αριθμό.",
  "report.validation.too_long": "Το κείμενο είναι πολύ μεγάλο.",
  "report.error.save_failed": "Δεν μπορέσαμε να αποθηκεύσουμε την αναφορά. Δοκίμασε ξανά.",
  "report.error.checkin_required": "Χρειάζεται πρώτα να δηλώσεις άφιξη.",
  "report.error.already_submitted": "Η αναφορά έχει ήδη υποβληθεί.",
  "report.error.cancelled": "Η βάρδια έχει ακυρωθεί.",
  "report.checkin_required_notice": "Χρειάζεται πρώτα να δηλώσεις άφιξη στο κατάστημα.",
  "report.back_to_checkin": "Δήλωση άφιξης",
  "report.already_submitted": "Η αναφορά έχει ήδη υποβληθεί. Ευχαριστούμε!",

  "waitlist.status.rate_limited": "Έγιναν πολλές προσπάθειες εγγραφής από αυτή τη σύνδεση. Δοκίμασε ξανά σε λίγο.",

  "shifts.coverage.filled": "{filled} από {required} καλυμμένες",
  "shifts.coverage.full": "Η βάρδια είναι πλήρως στελεχωμένη.",

  "shifts.board.title": "Κατάσταση βάρδιας",
  "shifts.board.none_title": "Δεν έχει σταλεί καμία πρόσκληση ακόμα",
  "shifts.board.none_description": "Προσκάλεσε τον πρώτο υποψήφιο παρακάτω για να ξεκινήσει η κάλυψη της βάρδιας.",
  "shifts.board.column.promoter": "Promoter",
  "shifts.board.column.state": "Κατάσταση",
  "shifts.board.column.detail": "Λεπτομέρειες",
  "shifts.board.column.actions": "Ενέργειες",
  "shifts.board.state.awaiting_reply": "Αναμονή απάντησης",
  "shifts.board.state.expired": "Έληξε, χωρίς απάντηση",
  "shifts.board.state.declined": "Αρνήθηκε",
  "shifts.board.state.confirmed": "Επιβεβαιωμένος/η",
  "shifts.board.state.checked_in": "Άφιξη (GPS)",
  "shifts.board.state.checked_in_manual": "Άφιξη (χειροκίνητα)",
  "shifts.board.state.no_show": "Δεν εμφανίστηκε",
  "shifts.board.state.cancelled": "Ακυρώθηκε",
  "shifts.board.sent_at": "Στάλθηκε: {when}",
  "shifts.board.expires_at": "Λήγει: {when}",
  "shifts.board.responded_at": "Απάντησε: {when}",
  "shifts.board.confirmed_at": "Επιβεβαίωσε: {when}",
  "shifts.board.checked_in_at": "Άφιξη: {when}",
  "shifts.board.cancelled_at": "Ακυρώθηκε: {when}",
  "shifts.board.distance": "{m} μ. από το κατάστημα",
  "shifts.board.within_geofence": "Εντός εμβέλειας καταστήματος",
  "shifts.board.outside_geofence": "Εκτός εμβέλειας καταστήματος",
  "shifts.board.reason_label": "Λόγος: {reason}",
  "shifts.board.started_no_checkin": "Η βάρδια έχει ξεκινήσει και δεν υπάρχει άφιξη ακόμα.",
  "shifts.board.cancel_action": "Ακύρωση ανάθεσης",
  "shifts.board.cancel_confirm": "Να ακυρωθεί η ανάθεση του/της {name};",
  "shifts.board.cancel_confirm_yes": "Ναι, ακύρωση",
  "shifts.board.invite_link.action": "Αντιγραφή συνδέσμου",
  "shifts.board.invite_link.message.intro": "Νέα βάρδια",
  "shifts.board.invite_link.message.cta": "Απάντησε εδώ:",
  "shifts.board.invite_link.error.missing_ids": "Κάτι λείπει από το αίτημα. Ανανέωσε τη σελίδα.",
  "shifts.board.invite_link.error.not_found": "Η πρόσκληση δεν βρέθηκε. Ανανέωσε τη σελίδα.",
  "shifts.board.invite_link.error.not_pending":
    "Η πρόσκληση δεν είναι πια ανοιχτή — απαντήθηκε ή ακυρώθηκε. Ανανέωσε τη σελίδα.",
  "shifts.board.invite_link.error.invitation_expired":
    "Η πρόσκληση έληξε. Ακύρωσέ την και στείλε καινούρια.",
  "shifts.board.invite_link.error.link_unavailable":
    "Ο σύνδεσμος αυτής της πρόσκλησης δεν μπορεί να ανακατασκευαστεί. Ακύρωσέ την και στείλε καινούρια.",
  "shifts.board.invite_link.error.blocked_read_only":
    "Ο λογαριασμός είναι σε κατάσταση μόνο για ανάγνωση, οπότε δεν στέλνονται προσκλήσεις. Τακτοποίησε τη Χρέωση.",
  "shifts.board.cancel_invite.action": "Ακύρωση πρόσκλησης",
  "shifts.board.cancel_invite.confirm":
    "Να αποσυρθεί η πρόσκληση του/της {name}; Ο σύνδεσμος που έχει σταματάει να δουλεύει και η βάρδια μπορεί να προταθεί σε άλλον/άλλη.",
  "shifts.board.cancel_invite.confirm_yes": "Ναι, απόσυρση",
  "shifts.board.cancel_invite.error.missing_ids": "Κάτι λείπει από το αίτημα. Ανανέωσε τη σελίδα.",
  "shifts.board.cancel_invite.error.not_found": "Η πρόσκληση δεν βρέθηκε. Ανανέωσε τη σελίδα.",
  "shifts.board.cancel_invite.error.not_pending":
    "Η πρόσκληση δεν είναι πια ανοιχτή. Ανανέωσε τη σελίδα.",
  "shifts.board.cancel_invite.error.save_failed": "Δεν αποθηκεύτηκε. Δοκίμασε ξανά.",
  "shifts.board.confirm_no": "Άκυρο",
  "shifts.board.cancel_reason_label": "Λόγος ακύρωσης (προαιρετικό)",
  "shifts.board.cancel_reason_placeholder": "π.χ. αρρώστησε",
  "shifts.board.no_show_action": "Δεν εμφανίστηκε",
  "shifts.board.no_show_confirm": "Να καταγραφεί ότι ο/η {name} δεν εμφανίστηκε στη βάρδια;",
  "shifts.board.no_show_confirm_yes": "Ναι, δεν εμφανίστηκε",
  "shifts.board.error.missing_ids": "Λείπουν στοιχεία στη φόρμα. Φόρτωσε ξανά τη σελίδα.",
  "shifts.board.error.not_found": "Δεν βρέθηκε αυτή η ανάθεση.",
  "shifts.board.error.not_confirmed": "Αυτή η ανάθεση δεν είναι πλέον επιβεβαιωμένη.",
  "shifts.board.error.save_failed": "Δεν αποθηκεύτηκε η αλλαγή. Δοκίμασε ξανά.",

  "shifts.replacements.title": "Επόμενοι υποψήφιοι",
  "shifts.replacements.why_title": "Γιατί χρειάζεται αναπλήρωση",
  "shifts.replacements.declined": "{name} αρνήθηκε — {when}",
  "shifts.replacements.cancelled": "Η ανάθεση του/της {name} ακυρώθηκε — {when}",
  "shifts.replacements.pending_count_one": "1 πρόσκληση σε αναμονή απάντησης",
  "shifts.replacements.pending_count_many": "{count} προσκλήσεις σε αναμονή απάντησης",
  "shifts.replacements.score_label": "Βαθμολογία αντιστοίχισης για {name}",
  "shifts.replacements.reinvite": "Πρόσκληση",

  // --- P19 — λογαριασμοί, ομάδα και πρώτα βήματα ---------------------------

  "onboarding.signin.title": "Συνδέσου για να συνεχίσεις",
  "onboarding.signin.body":
    "Στείλε στον εαυτό σου έναν σύνδεσμο σύνδεσης και επέστρεψε εδώ για να δημιουργήσεις το πρακτορείο σου.",
  "onboarding.signin.cta": "Σύνδεση",

  "onboarding.create.title": "Δημιούργησε το πρακτορείο σου",
  "onboarding.create.subtitle": "Τρία στοιχεία και είσαι μέσα. Γίνεσαι ιδιοκτήτης του λογαριασμού.",
  "onboarding.create.name_label": "Όνομα πρακτορείου",
  "onboarding.create.name_hint":
    "Όπως το ξέρουν οι πελάτες σου. Θα το βλέπει η ομάδα σου στις προσκλήσεις.",
  "onboarding.create.name_placeholder": "π.χ. Field Force Athens",
  "onboarding.create.city_label": "Πόλη βάσης",
  "onboarding.create.city_hint": "Προαιρετικό. Δείχνει πού δουλεύεις κυρίως.",
  "onboarding.create.city_placeholder": "π.χ. Αθήνα",
  "onboarding.create.timezone_label": "Ζώνη ώρας",
  "onboarding.create.timezone_hint": "Όλες οι ώρες βαρδιών εμφανίζονται σε αυτή τη ζώνη.",
  "onboarding.create.full_name_label": "Το όνομά σου",
  "onboarding.create.full_name_hint": "Προαιρετικό. Έτσι θα σε βλέπει η ομάδα σου.",
  "onboarding.create.submit": "Δημιουργία πρακτορείου",
  "onboarding.create.submitting": "Δημιουργία…",
  "onboarding.create.trial_note": "14 ημέρες δοκιμή. Δεν χρειάζεται κάρτα.",
  "onboarding.create.invited_instead":
    "Σε προσκάλεσε συνάδελφος; Άνοιξε τον σύνδεσμο που έλαβες με email αντί να δημιουργήσεις νέο πρακτορείο.",

  "onboarding.errors.name_too_short": "Γράψε το όνομα του πρακτορείου (τουλάχιστον 2 χαρακτήρες).",
  "onboarding.errors.name_too_long": "Το όνομα είναι πολύ μεγάλο (έως 120 χαρακτήρες).",
  "onboarding.errors.city_too_long": "Η πόλη είναι πολύ μεγάλη (έως 80 χαρακτήρες).",
  "onboarding.errors.timezone_invalid": "Διάλεξε μία από τις διαθέσιμες ζώνες ώρας.",
  "onboarding.errors.already_in_agency":
    "Ανήκεις ήδη σε πρακτορείο. Ένας λογαριασμός ανήκει σε ένα μόνο πρακτορείο.",
  "onboarding.errors.not_authenticated": "Η σύνδεσή σου έληξε. Συνδέσου ξανά και δοκίμασε πάλι.",
  "onboarding.errors.no_email":
    "Ο λογαριασμός σου δεν έχει email. Συνδέσου ξανά με σύνδεσμο email.",
  "onboarding.errors.unknown":
    "Δεν ολοκληρώθηκε η δημιουργία. Φόρτωσε ξανά τη σελίδα και δοκίμασε πάλι.",

  "onboarding.title": "Τα πρώτα σου βήματα",
  "onboarding.subtitle": "{agency} — τρία βήματα μέχρι την πρώτη κατάταξη promoters.",
  "onboarding.progress": "{done} από {total} βήματα ολοκληρωμένα",
  "onboarding.trial_ends": "η δοκιμή λήγει {date}",
  "onboarding.skip_all": "Θα το κάνω αργότερα",
  "onboarding.settings_link": "Ρυθμίσεις και ομάδα",
  "onboarding.step.done": "Έγινε",
  "onboarding.step.optional": "Προαιρετικό",
  "onboarding.step.count": "{count} από {target}",
  "onboarding.step.promoters.title": "Πρόσθεσε τους πρώτους τρεις promoters",
  "onboarding.step.promoters.why":
    "Με λιγότερους από τρεις, η κατάταξη δεν έχει τι να συγκρίνει.",
  "onboarding.step.promoters.cta": "Νέος promoter",
  "onboarding.step.campaign.title": "Δημιούργησε την πρώτη καμπάνια",
  "onboarding.step.campaign.why":
    "Η καμπάνια κρατά τον πελάτη, το κατάστημα και την αμοιβή — τα χρειάζεται η βάρδια.",
  "onboarding.step.campaign.cta": "Νέα καμπάνια",
  "onboarding.step.shift.title": "Άνοιξε την πρώτη βάρδια",
  "onboarding.step.shift.why":
    "Η βάρδια είναι αυτό που προσφέρεις: ημερομηνία, ώρα, κατάστημα, πόσα άτομα.",
  "onboarding.step.shift.cta": "Στις καμπάνιες",
  "onboarding.step.team.title": "Κάλεσε την ομάδα σου",
  "onboarding.step.team.why":
    "Οι συντονιστές σου δουλεύουν στα ίδια δεδομένα, χωρίς κοινόχρηστο κωδικό.",
  "onboarding.step.team.cta": "Πρόσκληση",
  "onboarding.aha.title": "Δες την κατάταξη",
  "onboarding.aha.body":
    "Άνοιξε τη βάρδια και δες ποιοι promoters ταιριάζουν — και γιατί ο καθένας είναι εκεί που είναι.",
  "onboarding.aha.locked":
    "Χρειάζεσαι μια βάρδια για να δεις κατάταξη. Ιδανικά και {count} promoters, ώστε η σειρά να έχει νόημα.",
  "onboarding.aha.cta": "Άνοιξε τη βάρδια",
  "onboarding.aha.locked_cta": "Δημιούργησε βάρδια",

  "onboarding.join.title": "Πρόσκληση στην ομάδα",
  "onboarding.join.invited_to": "Προσκλήθηκες στο {agency}",
  "onboarding.join.role_label": "Ρόλος",
  "onboarding.join.sent_to": "Στάλθηκε στο {email}",
  "onboarding.join.expires": "Λήγει {when}",
  "onboarding.join.signin_title": "Συνδέσου για να αποδεχτείς",
  "onboarding.join.signin_body":
    "Η πρόσκληση ισχύει μόνο για το {email}. Θα σου στείλουμε σύνδεσμο σύνδεσης και θα επιστρέψεις εδώ.",
  "onboarding.join.signin_cta": "Σύνδεση",
  "onboarding.join.accept_body": "Με την αποδοχή αποκτάς πρόσβαση στα δεδομένα του {agency}.",
  "onboarding.join.accept": "Αποδοχή πρόσκλησης",
  "onboarding.join.accepting": "Γίνεται αποδοχή…",
  "onboarding.join.wrong_email_title": "Είσαι συνδεδεμένος/η με άλλο email",
  "onboarding.join.wrong_email_body":
    "Η πρόσκληση στάλθηκε στο {invited}, αλλά είσαι συνδεδεμένος/η ως {current}. Αποσυνδέσου και συνδέσου με το σωστό email.",
  "onboarding.join.sign_out_and_return": "Αποσύνδεση και επιστροφή εδώ",
  "onboarding.join.already_in_agency_body":
    "Ανήκεις ήδη σε πρακτορείο, οπότε αυτή η πρόσκληση δεν χρειάζεται. Ένας λογαριασμός ανήκει σε ένα μόνο πρακτορείο.",
  "onboarding.join.go_to_app": "Στις βάρδιες",
  "onboarding.join.invalid_title": "Ο σύνδεσμος δεν είναι έγκυρος",
  "onboarding.join.invalid_body":
    "Ζήτα από τον ιδιοκτήτη του λογαριασμού να σου στείλει νέα πρόσκληση.",
  "onboarding.join.expired_title": "Η πρόσκληση έληξε",
  "onboarding.join.expired_body":
    "Οι προσκλήσεις ισχύουν για επτά ημέρες. Ζήτα νέα από τον ιδιοκτήτη του λογαριασμού.",
  "onboarding.join.used_title": "Η πρόσκληση έχει ήδη χρησιμοποιηθεί",
  "onboarding.join.used_body":
    "Κάθε πρόσκληση ισχύει μία φορά. Αν είσαι ήδη μέλος, απλώς συνδέσου.",
  "onboarding.join.error_way_out": "Πήγαινε στα πρώτα βήματα",

  "team.title": "Ομάδα",
  "team.subtitle": "Ποιος έχει πρόσβαση στα δεδομένα του {agency}.",
  "team.back_to_settings": "Ρυθμίσεις",
  "team.seats": "{used} από {limit} θέσεις σε χρήση",
  "team.members_title": "Μέλη",
  "team.you": "(εσύ)",
  "team.readonly_notice":
    "Μόνο ο ιδιοκτήτης του λογαριασμού μπορεί να προσκαλεί, να αλλάζει ρόλους και να αφαιρεί μέλη.",
  "team.no_agency_title": "Δεν ανήκεις ακόμα σε πρακτορείο",
  "team.no_agency_body":
    "Δημιούργησε το πρακτορείο σου ή άνοιξε τον σύνδεσμο πρόσκλησης που έλαβες.",
  "team.no_agency_cta": "Δημιουργία πρακτορείου",
  "team.status.active": "Ενεργό",
  "team.status.invited": "Εκκρεμεί",
  "team.status.removed": "Αφαιρέθηκε",
  "team.role.owner": "Ιδιοκτήτης",
  "team.role.coordinator": "Συντονιστής",
  "team.role.supervisor": "Επόπτης",
  "team.role.admin": "Διαχειριστής",

  "team.invite.title": "Πρόσκληση συναδέλφου",
  "team.invite.subtitle":
    "Στέλνεις έναν σύνδεσμο. Ο συνάδελφος συνδέεται με το δικό του email — χωρίς κοινόχρηστους κωδικούς.",
  "team.invite.email_label": "Email συναδέλφου",
  "team.invite.email_hint": "Η πρόσκληση ισχύει μόνο για αυτή τη διεύθυνση και για επτά ημέρες.",
  "team.invite.email_placeholder": "onoma@etaireia.gr",
  "team.invite.role_label": "Ρόλος",
  "team.invite.role_hint":
    "Ο συντονιστής βλέπει και διαχειρίζεται τη δουλειά. Μόνο ο ιδιοκτήτης διαχειρίζεται την ομάδα.",
  "team.invite.submit": "Δημιουργία πρόσκλησης",
  "team.invite.submitting": "Δημιουργία…",
  "team.invite.sent_title": "Η πρόσκληση για {email} είναι έτοιμη",
  "team.invite.sent_body":
    "Στείλε τον σύνδεσμο στον συνάδελφό σου. Ισχύει μία φορά και λήγει σε επτά ημέρες.",
  "team.invite.copy_link": "Αντιγραφή συνδέσμου",
  "team.invite.copied": "Αντιγράφηκε",
  "team.invite.no_seats_title": "Δεν υπάρχουν ελεύθερες θέσεις",
  "team.invite.no_seats_body":
    "Αφαίρεσε ένα μέλος ή ακύρωσε μια εκκρεμή πρόσκληση για να ελευθερώσεις θέση.",

  "team.pending_title": "Εκκρεμείς προσκλήσεις",
  "team.pending_none_title": "Καμία εκκρεμής πρόσκληση",
  "team.pending_none_body": "Όταν προσκαλέσεις κάποιον, θα εμφανιστεί εδώ μέχρι να συνδεθεί.",
  "team.pending.expires": "Λήγει {when}",
  "team.pending.expired": "Έληξε {when}",
  "team.pending.revoke": "Ακύρωση",

  "team.removed_title": "Μέλη χωρίς πρόσβαση",
  "team.removed_body": "Το ιστορικό τους παραμένει. Μπορείς να τους ξαναπροσκαλέσεις όποτε θες.",

  "team.role_change.label": "Ρόλος",
  "team.role_change.submit": "Αλλαγή ρόλου",
  "team.role_change.done": "Ο ρόλος άλλαξε.",
  "team.role_change.self_blocked": "Δεν μπορείς να αλλάξεις τον δικό σου ρόλο.",
  "team.role_change.last_owner_blocked":
    "Είναι ο τελευταίος ιδιοκτήτης. Όρισε πρώτα δεύτερο ιδιοκτήτη.",

  "team.remove.action": "Αφαίρεση από την ομάδα",
  "team.remove.confirm_title": "Να αφαιρεθεί ο/η {name};",
  "team.remove.consequence_access":
    "Χάνει αμέσως την πρόσβαση σε όλα τα δεδομένα του πρακτορείου.",
  "team.remove.consequence_history": "Το όνομά του/της παραμένει σε ό,τι έχει καταχωρήσει.",
  "team.remove.consequence_seat":
    "Ελευθερώνεται μία θέση και μπορείς να τον/την ξαναπροσκαλέσεις.",
  "team.remove.confirm": "Ναι, αφαίρεσέ τον/την",
  "team.remove.cancel": "Άκυρο",
  "team.remove.self_blocked": "Δεν μπορείς να αφαιρέσεις τον εαυτό σου.",
  "team.remove.last_owner_blocked":
    "Είναι ο τελευταίος ιδιοκτήτης και δεν μπορεί να αφαιρεθεί.",

  "team.errors.not_authenticated": "Η σύνδεσή σου έληξε. Συνδέσου ξανά και δοκίμασε πάλι.",
  "team.errors.not_owner": "Μόνο ο ιδιοκτήτης του λογαριασμού μπορεί να το κάνει αυτό.",
  "team.errors.no_agency": "Ο λογαριασμός σου δεν συνδέεται με πρακτορείο.",
  "team.errors.no_email": "Ο λογαριασμός σου δεν έχει email. Συνδέσου ξανά με σύνδεσμο email.",
  "team.errors.email_invalid": "Γράψε μια έγκυρη διεύθυνση email.",
  "team.errors.role_invalid": "Διάλεξε έναν από τους διαθέσιμους ρόλους.",
  "team.errors.token_invalid": "Ο σύνδεσμος πρόσκλησης δεν δημιουργήθηκε σωστά. Δοκίμασε ξανά.",
  "team.errors.already_member": "Αυτό το email ανήκει ήδη σε μέλος της ομάδας σου.",
  "team.errors.belongs_to_other_agency":
    "Αυτό το email ανήκει ήδη σε άλλο πρακτορείο. Ένας λογαριασμός ανήκει σε ένα μόνο πρακτορείο.",
  "team.errors.seat_limit_reached":
    "Έφτασες το όριο θέσεων του πακέτου σου. Ελευθέρωσε μία θέση ή αναβάθμισε.",
  "team.errors.seat_limit_reached_accept":
    "Το πρακτορείο δεν έχει ελεύθερη θέση αυτή τη στιγμή. Ζήτα από τον ιδιοκτήτη να ελευθερώσει μία.",
  "team.errors.invitation_not_found": "Δεν βρέθηκε αυτή η πρόσκληση. Ζήτα νέα.",
  "team.errors.invitation_used": "Η πρόσκληση έχει ήδη χρησιμοποιηθεί.",
  "team.errors.invitation_expired": "Η πρόσκληση έληξε. Ζήτα νέα.",
  "team.errors.invitation_email_mismatch": "Η πρόσκληση στάλθηκε σε άλλη διεύθυνση email.",
  "team.errors.already_in_agency": "Ανήκεις ήδη σε πρακτορείο.",
  "team.errors.member_not_found": "Δεν βρέθηκε αυτό το μέλος στην ομάδα σου.",
  "team.errors.member_inactive": "Αυτό το μέλος δεν έχει ήδη πρόσβαση.",
  "team.errors.cannot_change_own_role": "Δεν μπορείς να αλλάξεις τον δικό σου ρόλο.",
  "team.errors.cannot_remove_self": "Δεν μπορείς να αφαιρέσεις τον εαυτό σου.",
  "team.errors.last_owner": "Το πρακτορείο πρέπει να έχει τουλάχιστον έναν ιδιοκτήτη.",
  "team.errors.signing_secret_missing":
    "Λείπει η ρύθμιση TOKEN_SIGNING_SECRET, οπότε δεν μπορεί να δημιουργηθεί σύνδεσμος πρόσκλησης.",
  "team.errors.unknown": "Η ενέργεια δεν ολοκληρώθηκε. Φόρτωσε ξανά τη σελίδα και δοκίμασε πάλι.",

  "settings.title": "Ρυθμίσεις",
  "settings.subtitle": "Ο λογαριασμός του πρακτορείου και η ομάδα σου.",
  "settings.agency.title": "Πρακτορείο",
  "settings.agency.name": "Όνομα",
  "settings.agency.city": "Πόλη",
  "settings.agency.timezone": "Ζώνη ώρας",
  "settings.agency.plan": "Πακέτο",
  "settings.agency.status": "Κατάσταση συνδρομής",
  "settings.agency.trial_ends": "Λήξη δοκιμής",
  "settings.agency.seats": "Θέσεις",
  "settings.agency.promoter_limit": "Promoters",
  "settings.agency.promoter_usage": "{used} από {limit}",
  "settings.agency.change_note":
    "Η αλλαγή ονόματος και πακέτου έρχεται μαζί με τη χρέωση, σε επόμενη έκδοση.",
  "settings.plan.starter": "Starter",
  "settings.plan.agency": "Agency",
  "settings.plan.multi_brand": "Multi-brand",
  "settings.subscription.trialing": "Σε δοκιμή",
  "settings.subscription.active": "Ενεργή",
  "settings.subscription.past_due": "Εκκρεμεί πληρωμή",
  "settings.subscription.canceled": "Ακυρωμένη",
  "settings.subscription.paused": "Σε παύση",
  "settings.card.team_title": "Ομάδα",
  "settings.card.team_body_owner":
    "Προσκάλεσε συναδέλφους, άλλαξε ρόλους και αφαίρεσε πρόσβαση.",
  "settings.card.team_body_staff": "Δες ποιος έχει πρόσβαση στα δεδομένα του πρακτορείου.",
  "settings.card.team_cta": "Διαχείριση ομάδας",
  "settings.card.onboarding_title": "Τα πρώτα σου βήματα",
  "settings.card.onboarding_body":
    "Δεν έφτασες ακόμα στην πρώτη κατάταξη promoters. Συνέχισε από εκεί που έμεινες.",
  "settings.card.onboarding_cta": "Συνέχεια",

  // --- P17 billing -----------------------------------------------------------------------
  "billing.title": "Χρέωση",
  "billing.subtitle": "Συνδρομή και τιμολόγια για {agency}.",
  "billing.back_to_settings": "Πίσω στις ρυθμίσεις",

  "billing.owner_only_title": "Μόνο ο ιδιοκτήτης βλέπει τη χρέωση",
  "billing.owner_only_body":
    "Η συνδρομή και τα τιμολόγια είναι ορατά μόνο στον ιδιοκτήτη του πρακτορείου. Ζήτησέ του να ανοίξει αυτή τη σελίδα ή να σου δώσει ρόλο ιδιοκτήτη.",

  "billing.no_agency_title": "Δεν βρέθηκε πρακτορείο",
  "billing.no_agency_body":
    "Ο λογαριασμός σου δεν είναι συνδεδεμένος με πρακτορείο, οπότε δεν υπάρχει συνδρομή να δείξουμε.",
  "billing.no_agency_cta": "Δημιουργία πρακτορείου",

  "billing.not_configured_title": "Η χρέωση δεν είναι ακόμα ενεργοποιημένη",
  "billing.not_configured_body":
    "Δεν έχει ρυθμιστεί κλειδί Stripe σε αυτή την εγκατάσταση, οπότε δεν μπορεί να ξεκινήσει συνδρομή. Όλα τα υπόλοιπα λειτουργούν κανονικά και η κατάσταση παρακάτω είναι πραγματική.",
  "billing.test_mode":
    "Δοκιμαστική λειτουργία Stripe: καμία πραγματική χρέωση δεν γίνεται σε αυτή την εγκατάσταση.",

  "billing.status.trialing": "Σε δοκιμή",
  "billing.status.active": "Ενεργή",
  "billing.status.past_due": "Εκκρεμεί πληρωμή",
  "billing.status.canceled": "Ακυρωμένη",
  "billing.status.paused": "Σε παύση",

  "billing.access.full": "Πλήρης πρόσβαση",
  "billing.access.grace": "Πλήρης πρόσβαση, με προειδοποίηση",
  "billing.access.read_only": "Μόνο ανάγνωση και εξαγωγή",

  "billing.notice.trial_ending.title": "Η δοκιμή τελειώνει σύντομα",
  "billing.notice.trial_ending.body":
    "Απομένουν {days} ημέρες δοκιμής. Διάλεξε πακέτο για να συνεχίσεις χωρίς διακοπή.",
  "billing.notice.trial_expired.title": "Η δοκιμή έληξε",
  "billing.notice.trial_expired.body":
    "Κρατάς πλήρη πρόσβαση για άλλες {days} ημέρες. Μετά ο λογαριασμός γίνεται μόνο για ανάγνωση και εξαγωγή — τίποτα δεν διαγράφεται.",
  "billing.notice.past_due.title": "Η πληρωμή δεν πέρασε",
  "billing.notice.past_due.body":
    "Η κάρτα απορρίφθηκε. Κρατάς πλήρη πρόσβαση για {days} ημέρες — καμία βάρδια δεν σταματά. Ενημέρωσε την κάρτα από τη διαχείριση χρέωσης.",
  "billing.notice.grace_ending.title": "Απομένουν λίγες ημέρες",
  "billing.notice.grace_ending.body":
    "Σε {days} ημέρες ο λογαριασμός γίνεται μόνο για ανάγνωση αν δεν ολοκληρωθεί η πληρωμή. Τα δεδομένα σου παραμένουν στη θέση τους.",
  "billing.notice.read_only_unpaid.title": "Ο λογαριασμός είναι σε ανάγνωση μόνο",
  "billing.notice.read_only_unpaid.body":
    "Μπορείς να δεις και να εξάγεις τα πάντα, αλλά όχι να κάνεις αλλαγές. Μια πληρωμή τον ξεκλειδώνει αμέσως. Δεν διαγράφουμε ποτέ τα δεδομένα σου για απλήρωτο λογαριασμό.",
  "billing.notice.paused.title": "Η συνδρομή είναι σε παύση",
  "billing.notice.paused.body":
    "Βλέπεις και εξάγεις τα πάντα. Για να συνεχίσεις τη δουλειά, ενεργοποίησε ξανά τη συνδρομή από τη διαχείριση χρέωσης.",
  "billing.notice.canceled.title": "Η συνδρομή ακυρώθηκε",
  "billing.notice.canceled.body":
    "Ο λογαριασμός είναι μόνο για ανάγνωση και εξαγωγή. Τα δεδομένα σου μένουν στη θέση τους και επιστρέφουν αμέσως με νέα συνδρομή.",

  "billing.current.title": "Τρέχουσα συνδρομή",
  "billing.current.plan": "Πακέτο",
  "billing.current.status": "Κατάσταση",
  "billing.current.trial_ends": "Λήξη δοκιμής",
  "billing.current.trial_days": "{date} — {days} ημέρες ακόμα",
  "billing.current.renews": "Επόμενη ανανέωση",
  "billing.current.access": "Πρόσβαση",
  "billing.current.no_subscription":
    "Δεν υπάρχει ακόμα ενεργή συνδρομή. Το πρακτορείο τρέχει με τα όρια του πακέτου Starter.",

  "billing.usage.title": "Χρήση",
  "billing.usage.seats": "Λογαριασμοί ομάδας",
  "billing.usage.promoters": "Promoters",
  "billing.usage.of_limit": "{used} από {limit}",
  "billing.usage.at_limit": "Στο όριο",
  "billing.usage.note":
    "Το όριο μπλοκάρει μόνο την προσθήκη νέων. Ό,τι υπάρχει ήδη συνεχίζει να δουλεύει κανονικά.",

  "billing.plans.title": "Πακέτα",
  "billing.plans.subtitle":
    "Σταθερή τιμή ανά πρακτορείο, όχι ανά promoter: ίδιος λογαριασμός τον Δεκέμβριο και τον Αύγουστο.",
  "billing.plan.starter": "Starter",
  "billing.plan.agency": "Agency",
  "billing.plan.multi_brand": "Multi-brand",
  "billing.plan.seats": "{count} λογαριασμοί ομάδας",
  "billing.plan.seats_unlimited": "Απεριόριστοι λογαριασμοί ομάδας",
  "billing.plan.promoters": "Έως {count} promoters",
  "billing.plan.price_missing":
    "Η τιμή αυτού του πακέτου δεν έχει δημιουργηθεί ακόμα στο Stripe.",

  "billing.interval.per_month": "/μήνα",
  "billing.interval.per_year": "/έτος",
  "billing.interval.annual_effective": "{price} τον μήνα, δύο μήνες δώρο",
  "billing.interval.switch_to_annual": "Ετήσια χρέωση — δύο μήνες δώρο",
  "billing.interval.switch_to_monthly": "Μηνιαία χρέωση",

  "billing.cta.subscribe": "Έναρξη συνδρομής",
  "billing.cta.change_plan": "Αλλαγή πακέτου",
  "billing.cta.unavailable":
    "Δεν μπορεί να πατηθεί ακόμα: η χρέωση δεν έχει ενεργοποιηθεί σε αυτόν τον λογαριασμό.",
  "billing.cta.current_plan": "Τρέχον πακέτο",
  "billing.cta.working": "Άνοιγμα Stripe…",

  "billing.portal.title": "Κάρτα, τιμολόγια και ακύρωση",
  "billing.portal.body":
    "Η αλλαγή κάρτας, τα τιμολόγια, το ΑΦΜ και η ακύρωση γίνονται στη σελίδα του Stripe. Τα στοιχεία της κάρτας δεν περνούν ποτέ από τους δικούς μας διακομιστές.",
  "billing.portal.cta": "Διαχείριση χρέωσης",
  "billing.portal.unavailable":
    "Θα ενεργοποιηθεί μόλις ξεκινήσει η πρώτη συνδρομή.",

  "billing.checkout.success_title": "Η πληρωμή καταχωρήθηκε",
  "billing.checkout.success_body":
    "Το Stripe μας ενημερώνει σε λίγα δευτερόλεπτα. Αν η κατάσταση παρακάτω δεν έχει αλλάξει, ανανέωσε τη σελίδα.",
  "billing.checkout.cancelled_title": "Δεν ολοκληρώθηκε η συνδρομή",
  "billing.checkout.cancelled_body":
    "Δεν χρεώθηκε τίποτα. Μπορείς να ξαναδοκιμάσεις όποτε θέλεις.",

  "billing.data_note":
    "Δεν διαγράφουμε ποτέ τα δεδομένα σου επειδή ένας λογαριασμός έμεινε απλήρωτος. Μπορείς να τα εξάγεις οποιαδήποτε στιγμή.",
  "billing.contact_note": "Συνδεδεμένος ως {email}.",

  "billing.errors.not_owner":
    "Μόνο ο ιδιοκτήτης του πρακτορείου μπορεί να αλλάξει τη συνδρομή.",
  "billing.errors.no_agency":
    "Ο λογαριασμός σου δεν είναι συνδεδεμένος με πρακτορείο. Ολοκλήρωσε πρώτα τη δημιουργία πρακτορείου.",
  "billing.errors.not_configured":
    "Η χρέωση δεν είναι ενεργοποιημένη σε αυτή την εγκατάσταση. Δεν λείπει κάτι από εσένα.",
  "billing.errors.price_missing":
    "Αυτό το πακέτο δεν έχει τιμή στο Stripe ακόμα. Διάλεξε άλλο πακέτο ή δοκίμασε αργότερα.",
  "billing.errors.plan_invalid": "Άγνωστο πακέτο. Διάλεξε ένα από τα τρία παραπάνω.",
  "billing.errors.no_customer":
    "Δεν υπάρχει ακόμα λογαριασμός πελάτη στο Stripe. Ξεκίνα μια συνδρομή πρώτα.",
  "billing.errors.stripe_unavailable":
    "Το Stripe δεν απάντησε. Δοκίμασε ξανά σε λίγο — δεν χρεώθηκε τίποτα.",
  "billing.errors.unknown":
    "Η ενέργεια δεν ολοκληρώθηκε. Δοκίμασε ξανά· αν επιμένει, στείλε μας το μήνυμα που βλέπεις.",

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
  "enforcement.suspended.title": "Το πρακτορείο έχει ανασταλεί",
  "enforcement.suspended.body":
    "Η πρόσβαση στον λογαριασμό διακόπηκε από την PromoterOS. Τα δεδομένα του πρακτορείου δεν διαγράφηκαν. Επικοινώνησε με τον ιδιοκτήτη του πρακτορείου ή με την υποστήριξή μας για περισσότερες πληροφορίες.",
  "enforcement.suspended.signout": "Αποσύνδεση",

  "enforcement.banner.billing_cta": "Χρέωση",
  "enforcement.banner.dismiss": "Απόκρυψη",

  "enforcement.settings.agency_note": "Η αλλαγή πακέτου γίνεται από τη Χρέωση, παρακάτω.",
  "enforcement.settings.billing_title": "Χρέωση",
  "enforcement.settings.billing_body_owner":
    "Δες το πακέτο, τη χρήση και τα τιμολόγια, ή άλλαξε συνδρομή.",
  "enforcement.settings.billing_body_staff":
    "Η χρέωση είναι ορατή μόνο στον ιδιοκτήτη του πρακτορείου.",
  "enforcement.settings.billing_cta": "Άνοιγμα χρέωσης",

  "enforcement.promoters.blocked_read_only":
    "Ο λογαριασμός είναι μόνο για ανάγνωση αυτή τη στιγμή, οπότε δεν μπορείς να προσθέσεις νέο promoter. Δες τη Χρέωση στις Ρυθμίσεις για να συνεχίσεις.",
  "enforcement.promoters.blocked_limit":
    "Έφτασες το όριο του πακέτου {plan} ({limit} promoters). Αναβάθμισε από τη Χρέωση στις Ρυθμίσεις για να προσθέσεις άλλον.",

  // --- P24 — write guards on the remaining server actions (shifts, campaigns, team, invitations) ---
  "enforcement.invitations.blocked_read_only":
    "Ο λογαριασμός είναι μόνο για ανάγνωση αυτή τη στιγμή, οπότε δεν μπορείς να στείλεις νέες προσκλήσεις. Δες τη Χρέωση στις Ρυθμίσεις για να συνεχίσεις.",
  "enforcement.campaigns.blocked_read_only_status":
    "Ο λογαριασμός είναι σε κατάσταση μόνο για ανάγνωση, οπότε η κατάσταση της καμπάνιας δεν αλλάζει. Τακτοποίησε τη Χρέωση και ξαναδοκίμασε.",
  "enforcement.campaigns.blocked_read_only_create":
    "Ο λογαριασμός είναι μόνο για ανάγνωση αυτή τη στιγμή, οπότε δεν μπορείς να δημιουργήσεις νέα καμπάνια. Δες τη Χρέωση στις Ρυθμίσεις για να συνεχίσεις.",
  "enforcement.campaigns.blocked_read_only_brief":
    "Ο λογαριασμός είναι μόνο για ανάγνωση αυτή τη στιγμή, οπότε δεν μπορείς να αποθηκεύσεις το brief. Δες τη Χρέωση στις Ρυθμίσεις για να συνεχίσεις.",
  "enforcement.campaigns.blocked_read_only_shifts":
    "Ο λογαριασμός είναι μόνο για ανάγνωση αυτή τη στιγμή, οπότε δεν μπορείς να προσθέσεις νέες βάρδιες. Δες τη Χρέωση στις Ρυθμίσεις για να συνεχίσεις.",
  "enforcement.team.blocked_read_only":
    "Ο λογαριασμός είναι μόνο για ανάγνωση αυτή τη στιγμή, οπότε δεν μπορείς να προσκαλέσεις ή να αλλάξεις ρόλο σε συνάδελφο. Δες τη Χρέωση στις Ρυθμίσεις για να συνεχίσεις.",
  "enforcement.team.blocked_seat_limit":
    "Έφτασες το όριο θέσεων του πακέτου {plan} ({limit} χρήστες). Αναβάθμισε από τη Χρέωση στις Ρυθμίσεις για να προσκαλέσεις άλλον.",

  // --- P28 — the exception dashboard ---------------------------------------------------------
  // Names appear without the article ("Μαρία δεν έχει κάνει check-in", not "Η Μαρία…") on
  // purpose: the article is gendered in Greek and `promoters.gender` is optional, so an
  // article would mislabel someone. Clipped, but never wrong.
  "dashboard.title": "Σήμερα",
  "dashboard.subtitle": "{date} · Τι χρειάζεται την προσοχή σου τώρα.",
  "dashboard.all_shifts": "Όλες οι βάρδιες",

  "dashboard.exceptions.title": "Χρειάζονται προσοχή",
  "dashboard.severity.critical": "Επείγοντα",
  "dashboard.severity.warning": "Χρειάζονται έλεγχο",
  "dashboard.severity.info": "Για ενημέρωση",
  "dashboard.standing_for": "Ισχύει εδώ και {duration}",

  "dashboard.empty.title": "Όλα υπό έλεγχο",
  "dashboard.empty.body":
    "Καμία βάρδια δεν χρειάζεται την παρέμβασή σου αυτή τη στιγμή. Οι εκκρεμείς προσκλήσεις έχουν ακόμη χρόνο, όσες βάρδιες ξεκίνησαν έχουν check-in και δεν λείπει καμία αναφορά πεδίου.",
  "dashboard.empty.hint": "Ο έλεγχος καλύπτει τις βάρδιες από {from} έως {to}.",
  "dashboard.empty.no_shifts.title": "Δεν υπάρχουν βάρδιες ακόμη",
  "dashboard.empty.no_shifts.body":
    "Μόλις δημιουργήσεις μια καμπάνια με βάρδιες, εδώ θα βλέπεις μόνο ό,τι χρειάζεται την προσοχή σου — τίποτα άλλο.",
  "dashboard.empty.no_shifts.cta": "Δημιουργία καμπάνιας",

  "dashboard.today.title": "Η σημερινή μέρα",
  "dashboard.today.shifts": "Βάρδιες σήμερα",
  "dashboard.today.coverage": "Κάλυψη",
  "dashboard.today.checked_in": "Έχουν κάνει check-in",
  "dashboard.today.of": "{done} από {total}",
  "dashboard.today.none": "Δεν υπάρχουν βάρδιες σήμερα.",

  "dashboard.when.now": "τώρα",
  "dashboard.when.in_minute": "σε 1 λεπτό",
  "dashboard.when.in_minutes": "σε {n} λεπτά",
  "dashboard.when.in_hour": "σε 1 ώρα",
  "dashboard.when.in_hours": "σε {n} ώρες",
  "dashboard.when.in_day": "σε 1 ημέρα",
  "dashboard.when.in_days": "σε {n} ημέρες",
  "dashboard.when.ago_minute": "πριν από 1 λεπτό",
  "dashboard.when.ago_minutes": "πριν από {n} λεπτά",
  "dashboard.when.ago_hour": "πριν από 1 ώρα",
  "dashboard.when.ago_hours": "πριν από {n} ώρες",
  "dashboard.when.ago_day": "πριν από 1 ημέρα",
  "dashboard.when.ago_days": "πριν από {n} ημέρες",

  "dashboard.duration.minute": "1 λεπτό",
  "dashboard.duration.minutes": "{n} λεπτά",
  "dashboard.duration.hour": "1 ώρα",
  "dashboard.duration.hours": "{n} ώρες",
  "dashboard.duration.day": "1 ημέρα",
  "dashboard.duration.days": "{n} ημέρες",

  "dashboard.ex.under_covered_one": "Η βάρδια στο {store} ξεκινά {when} και λείπει ένα άτομο.",
  "dashboard.ex.under_covered_many": "Η βάρδια στο {store} ξεκινά {when} και λείπουν {missing} άτομα.",
  "dashboard.ex.under_covered_started_one":
    "Η βάρδια στο {store} ξεκίνησε {when} και λείπει ένα άτομο.",
  "dashboard.ex.under_covered_started_many":
    "Η βάρδια στο {store} ξεκίνησε {when} και λείπουν {missing} άτομα.",
  "dashboard.ex.invitation_expiring":
    "{promoter} δεν έχει απαντήσει ακόμη για τη βάρδια στο {store} και η πρόσκληση λήγει {when}.",
  "dashboard.ex.invitation_expired":
    "Η πρόσκληση για {promoter} στη βάρδια στο {store} έληξε {when} χωρίς απάντηση.",
  "dashboard.ex.declined":
    "{promoter} αρνήθηκε τη βάρδια στο {store} {when} και η βάρδια είναι ακόμη ακάλυπτη.",
  "dashboard.ex.cancelled":
    "{promoter} ακύρωσε τη βάρδια στο {store} {when} και χρειάζεται αντικατάσταση.",
  "dashboard.ex.no_check_in":
    "Η βάρδια στο {store} ξεκίνησε {when} και {promoter} δεν έχει κάνει check-in.",
  "dashboard.ex.outside_geofence":
    "{promoter} έκανε check-in {distance} μέτρα μακριά από το κατάστημα {store}.",
  "dashboard.ex.outside_geofence_unknown":
    "{promoter} έκανε check-in εκτός της περιοχής του καταστήματος {store}.",
  "dashboard.ex.manual_override":
    "{promoter} επιβεβαίωσε άφιξη χειροκίνητα στο {store} — δεν είναι πρόβλημα, απλώς δεν επιβεβαιώθηκε από την τοποθεσία.",
  "dashboard.ex.missing_report":
    "Η βάρδια στο {store} τελείωσε {when} και {promoter} δεν έχει στείλει αναφορά πεδίου.",

  "dashboard.action.open_shift": "Άνοιγμα βάρδιας",
  "dashboard.action.find_replacement": "Εύρεση αντικατάστασης",
  "dashboard.action.chase_reply": "Έλεγχος πρόσκλησης",
  "dashboard.action.review_check_in": "Έλεγχος check-in",
  "dashboard.action.request_report": "Έλεγχος αναφοράς",

  // --- P32 · Ενημέρωση promoter για τα προσωπικά δεδομένα (/privacy/promoters) ---------------
  // Γραμμένο για να το διαβάσει promoter στο κινητό, μία φορά, όρθια σε ένα σούπερ μάρκετ.
  // Καμία συγκατάθεση, πουθενά: δείτε docs/decisions.md D5.
  "promoter_privacy.link": "Τα προσωπικά σου δεδομένα",
  "promoter_privacy.title": "Τα προσωπικά σου δεδομένα",
  "promoter_privacy.intro":
    "Εδώ γράφει ποια στοιχεία σου κρατάει το {agency}, γιατί τα κρατάει και τι μπορείς να ζητήσεις. Χωρίς νομικά, μία φορά διάβασμα.",

  "promoter_privacy.controller_title": "Ποιος είναι υπεύθυνος",
  "promoter_privacy.controller_body":
    "Υπεύθυνος επεξεργασίας των δεδομένων σου είναι το {agency} ({agencyLegal}) — το πρακτορείο που σε καλεί στις βάρδιες. Αυτό αποφασίζει τι κρατάει για σένα και για πόσο.\nΤο {processor} είναι μόνο το λογισμικό: επεξεργάζεται τα δεδομένα σου για λογαριασμό του {agency} και με δικές του εντολές, δεν τα χρησιμοποιεί για δικό του σκοπό και δεν τα δίνει σε άλλο πρακτορείο.\nΓια οτιδήποτε αφορά τα δεδομένα σου γράψε στο {agencyEmail}.",

  "promoter_privacy.data_title": "Τι κρατάμε",
  "promoter_privacy.data_body":
    "• Ονοματεπώνυμο, τηλέφωνο και email.\n• Τις περιοχές όπου δέχεσαι να δουλέψεις και αν έχεις αυτοκίνητο ή δίπλωμα.\n• Τις δεξιότητες που έχεις δηλώσει.\n• Τη διαθεσιμότητά σου — ποιες μέρες και ώρες μπορείς.\n• Το ιστορικό της δουλειάς σου: ποιες προσκλήσεις έλαβες, τι απάντησες, ποιες βάρδιες κάλυψες, ποιες ακυρώθηκαν.\n• Την ώρα που δήλωσες άφιξη και πόσα μέτρα απείχες από το κατάστημα εκείνη τη στιγμή.\n• Τις αναφορές πεδίου και τις φωτογραφίες που στέλνεις μετά τη βάρδια.",

  "promoter_privacy.not_held_title": "Τι δεν κρατάμε",
  "promoter_privacy.not_held_body":
    "Δεν κρατάμε ιστορικό τοποθεσίας. Καθόλου.\nΌταν πατάς «Δήλωσα άφιξη», το κινητό σου δίνει τη θέση σου μία φορά, εκείνη ακριβώς τη στιγμή. Υπολογίζουμε πόσα μέτρα απέχεις από το κατάστημα και η θέση σβήνεται αμέσως. Δεν αποθηκεύεται πουθενά — ο πίνακας των αφίξεων δεν έχει καν στήλες για συντεταγμένες.\nΔεν σε παρακολουθούμε στο παρασκήνιο, ούτε στη βάρδια ούτε εκτός. Δεν διαβάζουμε τα μηνύματά σου. Δεν κρατάμε ταυτότητα, ΑΦΜ ή τραπεζικά στοιχεία — η μισθοδοσία δεν περνάει από εδώ. Και τα στοιχεία σου δεν πάνε ποτέ σε άλλο πρακτορείο.\nΑν η τοποθεσία δεν δουλέψει ή δεν θέλεις να τη δώσεις, δηλώνεις άφιξη χειροκίνητα. Η τοποθεσία δεν είναι ποτέ ο λόγος που δεν θα πληρωθείς.",

  "promoter_privacy.purpose_title": "Γιατί τα κρατάμε",
  "promoter_privacy.purpose_body":
    "Για να σου προτείνει το {agency} βάρδιες που όντως σου ταιριάζουν — κοντά σου, στις ώρες που μπορείς, σε δουλειά που ξέρεις. Για να σου στείλει την πρόσκληση και να κρατήσει την απάντησή σου. Για να ξέρει ποιος καλύπτει κάθε βάρδια και να βρει αντικατάσταση αν χρειαστεί. Για να επιβεβαιώσει ότι η βάρδια έγινε και να ετοιμάσει την αναφορά προς τον πελάτη.",

  "promoter_privacy.basis_title": "Με ποιο δικαίωμα",
  "promoter_privacy.basis_body":
    "Δύο νομικές βάσεις, καμία από τις δύο δεν είναι η συγκατάθεσή σου.\n• Εκτέλεση της συμφωνίας μας μαζί σου: χωρίς το τηλέφωνό σου και τη διαθεσιμότητά σου δεν γίνεται να σε καλέσουμε σε βάρδια.\n• Έννομο συμφέρον του πρακτορείου: να καλύπτει τις βάρδιες που έχει αναλάβει, να ξέρει ποιος ήταν εκεί και να παραδίδει σωστή αναφορά στον πελάτη.\nΔεν σου ζητάμε συγκατάθεση και αυτό είναι σκόπιμο. Σε σχέση εργασίας η συγκατάθεση δεν είναι πραγματικά ελεύθερη — δύσκολα λες όχι σε αυτόν που σε καλεί στη δουλειά — οπότε δεν θα ήταν έγκυρη βάση και δεν στηριζόμαστε σε αυτήν. Έχεις πάντως δικαίωμα να εναντιωθείς σε ό,τι στηρίζεται στο έννομο συμφέρον.",

  "promoter_privacy.retention_title": "Για πόσο καιρό",
  "promoter_privacy.retention_body":
    "Τα στοιχεία που σε ταυτοποιούν κρατιούνται όσο συνεργάζεσαι με το {agency} και για ένα ορισμένο διάστημα μετά την τελευταία σου δραστηριότητα. Το ακριβές διάστημα το ορίζει το {agency} — ρώτησέ το στο {agencyEmail}.\nΜετά από αυτό διαγράφονται αυτόματα: το προφίλ σου, η διαθεσιμότητα, οι δεξιότητες, οι προσκλήσεις και το ιστορικό ανά πελάτη σβήνονται οριστικά. Μένει μόνο το λειτουργικό ίχνος της κάθε βάρδιας — ότι καλύφθηκε και τι έγινε εκεί — χωρίς κανένα στοιχείο που να οδηγεί σε εσένα.",

  "promoter_privacy.rights_title": "Τι μπορείς να ζητήσεις",
  "promoter_privacy.rights_body":
    "• Αντίγραφο όλων όσων κρατάμε για σένα.\n• Διόρθωση ό,τι είναι λάθος.\n• Διαγραφή των στοιχείων σου.\n• Εναντίωση στην επεξεργασία που στηρίζεται στο έννομο συμφέρον.\n• Περιορισμό της επεξεργασίας ή φορητότητα των δεδομένων σου.\nΣτείλε email στο {agencyEmail}. Παίρνεις απάντηση το αργότερο σε έναν μήνα και δεν πληρώνεις τίποτα. Αν δεν μείνεις ικανοποιημένη, μπορείς να προσφύγεις στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα (dpa.gr).",

  "promoter_privacy.processor_note":
    "Το λογισμικό το παρέχει το {processor} ως εκτελών την επεξεργασία. Αν θέλεις να επικοινωνήσεις μαζί μας απευθείας: {processorEmail}. Για διαγραφή ή αντίγραφο των δεδομένων σου απευθύνσου πρώτα στο πρακτορείο — εμείς ενεργούμε μόνο κατ' εντολή του.",

  // --- P29 · Campaign and client reporting (product-spec §11) -------------------------------
  "campaign_report.back": "← Καμπάνια",
  "campaign_report.title": "Αναφορά: {campaign}",
  "campaign_report.export_shifts": "CSV ανά βάρδια",
  "campaign_report.export_stores": "CSV ανά κατάστημα",
  "campaign_report.generated": "Δημιουργήθηκε {at} (ώρα Ελλάδας).",
  "campaign_report.of": "{done} από {total}",

  "campaign_report.truncated.title": "Η αναφορά δείχνει μέρος της καμπάνιας",
  "campaign_report.truncated.body":
    "Η καμπάνια έχει περισσότερες γραμμές από όσες φορτώνει αυτή η σελίδα, οπότε τα νούμερα δεν καλύπτουν όλη την περίοδο. Μη στείλεις αυτή την αναφορά σε πελάτη — επικοινώνησε μαζί μας πρώτα.",

  "campaign_report.overview.title": "Ταυτότητα αναφοράς",
  "campaign_report.overview.client": "Πελάτης",
  "campaign_report.overview.period": "Περίοδος",
  "campaign_report.overview.stores": "Καταστήματα ({count})",
  "campaign_report.overview.promoters": "Promoters ({count})",

  "campaign_report.basis.complete": "Από όλες τις {expected} αναφορές πεδίου.",
  "campaign_report.basis.partial":
    "Από {arrived} από {expected} αναφορές πεδίου — λείπουν {missing}.",
  "campaign_report.basis.none_expected": "Δεν αναμένεται ακόμη καμία αναφορά πεδίου.",
  "campaign_report.basis.field_partial":
    "{reported} από τις {arrived} αναφορές που ήρθαν συμπλήρωσαν αυτό το πεδίο.",
  "campaign_report.basis.incomplete": "Μερικά δεδομένα",

  "campaign_report.totals.title": "Αποτελέσματα πεδίου",
  "campaign_report.totals.units": "Τεμάχια σε προώθηση",
  "campaign_report.totals.sales": "Πωλήσεις",
  "campaign_report.totals.interactions": "Επαφές με πελάτες",

  "campaign_report.coverage.title": "Κάλυψη",
  "campaign_report.coverage.shifts": "Βάρδιες",
  "campaign_report.coverage.filled": "Θέσεις καλυμμένες",
  "campaign_report.coverage.completion": "Ποσοστό κάλυψης",
  "campaign_report.coverage.cancelled_shifts": "Ακυρωμένες βάρδιες",
  "campaign_report.coverage.cancellations": "Ακυρώσεις promoter",
  "campaign_report.coverage.no_shows": "Μη προσελεύσεις",
  "campaign_report.coverage.note":
    "Καλυμμένη θέση = promoter που δούλεψε ή είναι κλεισμένος. Ακύρωση και μη προσέλευση δεν μετρούν ως καλυμμένες, γιατί ο πελάτης δεν πήρε αυτό το άτομο στο κατάστημα. Οι ακυρωμένες βάρδιες δεν μπαίνουν στον παρονομαστή.",

  "campaign_report.attendance.title": "Προσέλευση",
  "campaign_report.attendance.checked_in": "Check-in",
  "campaign_report.attendance.not_checked_in": "Χωρίς check-in",
  "campaign_report.attendance.within_geofence": "Εντός περιοχής καταστήματος",
  "campaign_report.attendance.outside_geofence": "Εκτός περιοχής",
  "campaign_report.attendance.geofence_unknown": "Χωρίς ένδειξη θέσης",
  "campaign_report.attendance.manual_overrides": "Χειροκίνητη επιβεβαίωση",
  "campaign_report.attendance.note":
    "Δύο διαφορετικοί άξονες πάνω στα ίδια check-in: πού ήταν και πώς καταγράφηκε. Μην τους προσθέτεις μεταξύ τους. Η χειροκίνητη επιβεβαίωση δεν είναι σφάλμα — υπάρχει ακριβώς για να μην κρίνει η τοποθεσία ποιος πληρώνεται.",

  "campaign_report.stores.title": "Ανά κατάστημα",
  "campaign_report.stores.hint": "Εδώ φαίνεται ποιο κατάστημα υστέρησε.",
  "campaign_report.stores.none": "Καμία βάρδια σε κατάστημα ακόμη.",
  "campaign_report.stores.col_store": "Κατάστημα",
  "campaign_report.stores.col_shifts": "Βάρδιες",
  "campaign_report.stores.col_coverage": "Κάλυψη",
  "campaign_report.stores.col_attendance": "Check-in",
  "campaign_report.stores.col_reports": "Αναφορές",
  "campaign_report.stores.col_units": "Τεμάχια",
  "campaign_report.stores.col_sales": "Πωλήσεις",
  "campaign_report.stores.col_interactions": "Επαφές",
  "campaign_report.stores.col_photos": "Φωτογραφίες",

  "campaign_report.photos.title": "Φωτογραφίες",
  "campaign_report.photos.count": "{count} συνολικά",
  "campaign_report.photos.none": "Δεν έχει ανέβει καμία φωτογραφία ακόμη.",
  "campaign_report.photos.meta": "{date} · {promoter}",
  "campaign_report.photos.alt": "Φωτογραφία πεδίου από {store}, {date}",
  "campaign_report.photos.unavailable": "Η φωτογραφία δεν είναι διαθέσιμη αυτή τη στιγμή",

  "campaign_report.notes.title": "Σχόλια και παρατηρήσεις",
  "campaign_report.notes.none": "Καμία παρατήρηση από το πεδίο ακόμη.",
  "campaign_report.notes.meta": "{store} · {date} · {promoter}",
  "campaign_report.notes.stock_issues": "Θέματα στοκ",
  "campaign_report.notes.manager": "Υπεύθυνος καταστήματος",

  "campaign_report.shifts.title": "Ανά βάρδια",
  "campaign_report.shifts.col_date": "Ημερομηνία",
  "campaign_report.shifts.col_store": "Κατάστημα",
  "campaign_report.shifts.col_promoters": "Promoters",
  "campaign_report.shifts.col_coverage": "Κάλυψη",
  "campaign_report.shifts.col_reports": "Αναφορές",
  "campaign_report.shifts.col_units": "Τεμάχια",
  "campaign_report.shifts.col_photos": "Φωτογραφίες",

  "campaign_report.empty.title": "Δεν έχει έρθει τίποτα από το πεδίο ακόμη",
  "campaign_report.empty.body":
    "Οι βάρδιες υπάρχουν, αλλά δεν έχει καταγραφεί καμία αναφορά και κανένα check-in. Δεν δείχνουμε μηδενικά σαν να ήταν αποτέλεσμα.",
  "campaign_report.empty.hint":
    "Αναμένονται {expected} αναφορές πεδίου. Θα εμφανιστούν εδώ μόλις τις στείλουν οι promoters.",
  "campaign_report.empty.no_shifts.title": "Η καμπάνια δεν έχει βάρδιες",
  "campaign_report.empty.no_shifts.body":
    "Χωρίς βάρδιες δεν υπάρχει τίποτα να αναφερθεί. Πρόσθεσε βάρδιες και η αναφορά γεμίζει μόνη της καθώς τρέχει η καμπάνια.",
  "campaign_report.empty.no_shifts.cta": "Προσθήκη βαρδιών",

  // --- P33 · Στοιχεία πρακτορείου και διατήρηση (/settings/agency) --------------------------
  // Ο υπεύθυνος επεξεργασίας που ονομάζει η /privacy/promoters (0014_retention.sql) και η
  // διάρκεια διατήρησης που χρησιμοποιεί το scripts/retention-sweep.ts. Γραμμένο για owner
  // που δεν είναι νομικός — η διατύπωση εδώ κουβαλάει όλο το βάρος.
  "agency_settings.title": "Στοιχεία πρακτορείου",
  "agency_settings.subtitle":
    "Ποιος είναι ο υπεύθυνος επεξεργασίας για τους promoters σου και πόσο καιρό κρατάς τα στοιχεία τους.",
  "agency_settings.back_to_settings": "Πίσω στις ρυθμίσεις",
  "agency_settings.card_title": "Νομική ταυτότητα και διατήρηση",
  "agency_settings.card_subtitle":
    "Αυτά τα στοιχεία εμφανίζονται στην ενημέρωση προσωπικών δεδομένων που βλέπουν οι promoters σου.",
  "agency_settings.incomplete.title": "Λείπουν στοιχεία",
  "agency_settings.incomplete.body":
    "Χωρίς επωνυμία και email επικοινωνίας, η σελίδα «Τα προσωπικά σου δεδομένα» δεν μπορεί να εμφανιστεί σε κανέναν promoter — θα δει σφάλμα αντί για την ενημέρωση που πρέπει να διαβάσει.",
  "agency_settings.not_set": "Δεν έχει οριστεί",
  "agency_settings.retention_value": "{months} μήνες",
  "agency_settings.readonly_notice": "Μόνο ο ιδιοκτήτης του πρακτορείου μπορεί να αλλάξει αυτά τα στοιχεία.",

  "agency_settings.form.legal_name.label": "Επωνυμία (νομικό πρόσωπο)",
  "agency_settings.form.legal_name.hint":
    "Όχι το όνομα που βλέπουν οι πελάτες — η επίσημη επωνυμία της εταιρείας σου, αυτή στην οποία απευθύνεται ένας promoter όταν ζητά διαγραφή των στοιχείων του.",
  "agency_settings.form.privacy_email.label": "Email επικοινωνίας για προσωπικά δεδομένα",
  "agency_settings.form.privacy_email.hint":
    "Εδώ φτάνει το αίτημα ενός promoter για πρόσβαση ή διαγραφή των στοιχείων του. Φτάνει στο πρακτορείο σου, ποτέ στο PromoterOS.",
  "agency_settings.form.retention.label": "Διατήρηση στοιχείων promoter (μήνες)",
  "agency_settings.form.retention.hint":
    "Πόσο καιρό κρατάς τα στοιχεία ενός promoter μετά την τελευταία του δραστηριότητα, πριν διαγραφούν αυτόματα.",
  "agency_settings.form.retention.reasoning":
    "Προτείνουμε 24 μήνες: η προωθητική δουλειά είναι εποχική, οπότε δύο κύκλοι είναι το μικρότερο διάστημα που δεν πετάει έναν χρήσιμο κατάλογο promoters.",
  "agency_settings.form.retention.not_advice":
    "Αυτό δεν είναι δική μας νομική σύσταση — επιβεβαίωσέ το με τον λογιστή ή τον νομικό σύμβουλο του πρακτορείου σου.",
  "agency_settings.form.submit": "Αποθήκευση",
  "agency_settings.form.submitting": "Αποθήκευση...",
  "agency_settings.form.saved": "Αποθηκεύτηκε.",

  "agency_settings.errors.not_owner": "Μόνο ο ιδιοκτήτης του πρακτορείου μπορεί να αλλάξει αυτά τα στοιχεία.",
  "agency_settings.errors.legal_name_required": "Γράψε την επωνυμία του πρακτορείου.",
  "agency_settings.errors.legal_name_too_long": "Η επωνυμία είναι πολύ μεγάλη — μέχρι 200 χαρακτήρες.",
  "agency_settings.errors.email_required": "Γράψε ένα email επικοινωνίας.",
  "agency_settings.errors.email_invalid": "Αυτό το email δεν φαίνεται σωστό.",
  "agency_settings.errors.retention_out_of_range": "Ο αριθμός μηνών πρέπει να είναι από 1 έως 240.",
  "agency_settings.errors.write_not_permitted":
    "Η αποθήκευση δεν επιτρέπεται αυτή τη στιγμή από τη βάση δεδομένων. Ενημέρωσε την ομάδα του PromoterOS — χρειάζεται μια αλλαγή στο backend πριν αποθηκευτεί αυτή η ρύθμιση.",
  "agency_settings.errors.unknown": "Η αποθήκευση δεν ολοκληρώθηκε. Φόρτωσε ξανά τη σελίδα και δοκίμασε πάλι.",

  "settings.card.identity_title": "Στοιχεία πρακτορείου",
  "settings.card.identity_body":
    "Η νομική επωνυμία, το email επικοινωνίας και η διατήρηση στοιχείων που βλέπουν οι promoters σου στην ενημέρωση προσωπικών δεδομένων.",
  "settings.card.identity_missing": "Λείπουν στοιχεία — η ενημέρωση προσωπικών δεδομένων δεν μπορεί να εμφανιστεί ακόμα.",
  "settings.card.identity_cta": "Συμπλήρωση στοιχείων",

  "onboarding.identity.title": "Συμπλήρωσε τα στοιχεία του πρακτορείου",
  "onboarding.identity.body":
    "Χωρίς επωνυμία και email επικοινωνίας, η ενημέρωση προσωπικών δεδομένων που πρέπει να δουν οι promoters σου δεν μπορεί να εμφανιστεί. Μπορείς να το κάνεις τώρα ή αργότερα.",
  "onboarding.identity.cta": "Στοιχεία πρακτορείου",

  // P30 — η promoter δηλώνει μόνη της τη διαθεσιμότητά της (/a/[token]).
  "promoter_availability.title": "Η διαθεσιμότητά σου",
  "promoter_availability.hello": "Γεια σου {name}.",
  "promoter_availability.intro":
    "Διάλεξε τις μέρες που μπορείς να δουλέψεις τις επόμενες δύο εβδομάδες. Κάθε επιλογή αποθηκεύεται αμέσως — δεν υπάρχει κουμπί στο τέλος.",
  "promoter_availability.timezone_note": "Όλες οι ώρες είναι ώρα Ελλάδας ({tz}).",
  "promoter_availability.footer":
    "Άνοιξε ξανά αυτόν τον σύνδεσμο όποτε αλλάξει το πρόγραμμά σου.",
  "promoter_availability.saving": "Αποθήκευση…",
  "promoter_availability.saved": "Αποθηκεύτηκε",

  "promoter_availability.choice.available": "Μπορώ",
  "promoter_availability.choice.partial": "Ωράριο",
  "promoter_availability.choice.unavailable": "Δεν μπορώ",
  "promoter_availability.choice.clear": "Καθάρισε τη μέρα",

  "promoter_availability.partial.from": "Από",
  "promoter_availability.partial.to": "Έως",
  "promoter_availability.partial.end_of_day": "Τέλος ημέρας",
  "promoter_availability.partial.apply": "Αποθήκευση ωραρίου",

  "promoter_availability.summary.not_set": "Δεν έχει οριστεί",
  "promoter_availability.summary.available": "Διαθέσιμη όλη μέρα",
  "promoter_availability.summary.unavailable": "Μη διαθέσιμη",
  "promoter_availability.summary.available_from": "Διαθέσιμη από {from}",
  "promoter_availability.summary.available_range": "Διαθέσιμη {from}–{to}",
  "promoter_availability.summary.unavailable_from": "Μη διαθέσιμη από {from}",
  "promoter_availability.summary.unavailable_range": "Μη διαθέσιμη {from}–{to}",

  "promoter_availability.source.coordinator":
    "Το καταχώρησε ο συντονιστής σου. Μπορείς να το αλλάξεις.",
  "promoter_availability.source.contradiction":
    "Υπάρχουν δύο διαφορετικές καταχωρήσεις γι' αυτή τη μέρα. Επίλεξε ξανά για να μείνει μία.",

  "promoter_availability.error.title": "Ο σύνδεσμος δεν λειτουργεί",
  "promoter_availability.error.ask_coordinator":
    "Ζήτησε από τον συντονιστή σου να σου στείλει καινούργιο σύνδεσμο.",
  "promoter_availability.error.expired": "Αυτός ο σύνδεσμος έληξε.",
  "promoter_availability.error.inactive": "Αυτός ο σύνδεσμος δεν είναι πλέον ενεργός.",
  "promoter_availability.error.not_found": "Δεν βρήκαμε το προφίλ σου.",
  "promoter_availability.error.bad_token":
    "Ο σύνδεσμος δεν είναι έγκυρος — μπορεί να κόπηκε κατά την αντιγραφή.",
  "promoter_availability.error.unreachable":
    "Δεν μπορέσαμε να διαβάσουμε τη διαθεσιμότητά σου αυτή τη στιγμή. Δοκίμασε ξανά σε λίγο.",
  "promoter_availability.error.bad_date":
    "Αυτή η ημερομηνία είναι εκτός των δύο εβδομάδων που εμφανίζονται.",
  "promoter_availability.error.bad_time": "Διάλεξε έγκυρη ώρα.",
  "promoter_availability.error.bad_range":
    "Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.",
  "promoter_availability.error.bad_choice": "Μη έγκυρη επιλογή.",
  "promoter_availability.error.save_failed": "Η μέρα δεν αποθηκεύτηκε. Πάτησε ξανά.",

  // P30 — ο σύνδεσμος από την πλευρά του συντονιστή.
  "availability_link.title": "Σύνδεσμος διαθεσιμότητας",
  "availability_link.description":
    "Στείλε τον στην promoter για να δηλώνει μόνη της πότε μπορεί. Δείχνει μόνο τη δική της διαθεσιμότητα — τίποτα άλλο από το σύστημα.",
  "availability_link.create": "Δημιουργία συνδέσμου",
  "availability_link.creating": "Δημιουργία…",
  "availability_link.regenerate": "Νέος σύνδεσμος",
  "availability_link.copied": "Αντιγράφηκε",
  "availability_link.expires": "Λήγει {date}",
  "availability_link.message_label": "Μήνυμα για αποστολή",
  "availability_link.message.greeting": "Γεια σου {name}!",
  "availability_link.message.body":
    "Δήλωσε εδώ πότε μπορείς να δουλέψεις τις επόμενες δύο εβδομάδες:",
  "availability_link.error.not_found": "Δεν βρέθηκε αυτή η promoter.",
  "availability_link.error.failed":
    "Δεν ήταν δυνατή η δημιουργία του συνδέσμου. Δοκίμασε ξανά.",

  // P34 — the app shell. Labels for the sidebar chrome only.
  "shell.section_operations": "Λειτουργία",
  "shell.section_account": "Λογαριασμός",
  "shell.open_menu": "Άνοιγμα μενού",
  "shell.close_menu": "Κλείσιμο μενού",
  "shell.skip_to_content": "Μετάβαση στο περιεχόμενο",

  // P5 — η διαθεσιμότητα μιας promoter, από την πλευρά του συντονιστή
  // (/promoters/[id]/availability). Ίδιο δεκαπενθήμερο και ίδιοι κανόνες με το promoter_availability.*
  // (/a/[token]) — βλ. lib/availability-links.ts — αλλά η εγγραφή φέρει source: 'coordinator'.
  "promoters.availability.title": "Διαθεσιμότητα — {name}",
  "promoters.availability.subtitle":
    "Το δεκαπενθήμερο που βλέπει και η ίδια η promoter. Όλες οι ώρες είναι ώρα Ελλάδας ({tz}).",
  "promoters.availability.back_to_profile": "Πίσω στο προφίλ",

  "promoters.availability.choice.available": "Μπορεί",
  "promoters.availability.choice.partial": "Ωράριο",
  "promoters.availability.choice.unavailable": "Δεν μπορεί",
  "promoters.availability.choice.clear": "Καθάρισε τη μέρα",

  "promoters.availability.partial.from": "Από",
  "promoters.availability.partial.to": "Έως",
  "promoters.availability.partial.end_of_day": "Τέλος ημέρας",
  "promoters.availability.partial.apply": "Αποθήκευση ωραρίου",

  "promoters.availability.saving": "Αποθήκευση…",
  "promoters.availability.saved": "Αποθηκεύτηκε",

  "promoters.availability.source.self": "Το δήλωσε η ίδια",
  "promoters.availability.source.coordinator": "Το καταχώρησες εσύ",
  "promoters.availability.source.contradiction":
    "Υπάρχουν δύο διαφορετικές καταχωρήσεις γι' αυτή τη μέρα. Επίλεξε ξανά για να μείνει μία.",
  "promoters.availability.status.undeclared": "Άγνωστη",

  "promoters.availability.summary.not_set": "Δεν έχει δηλωθεί — δεν προτείνεται στο matching",
  "promoters.availability.summary.available": "Διαθέσιμη όλη μέρα",
  "promoters.availability.summary.unavailable": "Μη διαθέσιμη",
  "promoters.availability.summary.available_from": "Διαθέσιμη από {from}",
  "promoters.availability.summary.available_range": "Διαθέσιμη {from}–{to}",
  "promoters.availability.summary.unavailable_from": "Μη διαθέσιμη από {from}",
  "promoters.availability.summary.unavailable_range": "Μη διαθέσιμη {from}–{to}",

  "promoters.availability.error.not_found": "Δεν βρέθηκε αυτή η promoter.",
  "promoters.availability.error.bad_date":
    "Αυτή η ημερομηνία είναι εκτός του δεκαπενθήμερου που εμφανίζεται.",
  "promoters.availability.error.bad_time": "Διάλεξε έγκυρη ώρα.",
  "promoters.availability.error.bad_range":
    "Η ώρα λήξης πρέπει να είναι μετά την ώρα έναρξης.",
  "promoters.availability.error.bad_choice": "Μη έγκυρη επιλογή.",
  "promoters.availability.error.save_failed": "Η μέρα δεν αποθηκεύτηκε. Πάτησε ξανά.",
  "promoters.availability.error.blocked_read_only":
    "Ο λογαριασμός είναι μόνο για ανάγνωση αυτή τη στιγμή, οπότε η διαθεσιμότητα δεν μπορεί να αλλάξει.",
  "promoters.availability.error.unreachable":
    "Δεν μπορέσαμε να διαβάσουμε τη διαθεσιμότητα αυτή τη στιγμή. Δοκίμασε ξανά σε λίγο.",

  "promoters.availability.bulk.title": "Γρήγορη καταχώρηση",
  "promoters.availability.bulk.weekdays": "Όλες τις καθημερινές",
  "promoters.availability.bulk.weekend": "Αυτό το Σαββατοκύριακο",
  "promoters.availability.bulk.clear_all": "Καθάρισε όλο το δεκαπενθήμερο",
  "promoters.availability.bulk.running": "Γίνεται καταχώρηση…",
  "promoters.availability.bulk.done_weekdays": "Οι καθημερινές ορίστηκαν ως διαθέσιμες.",
  "promoters.availability.bulk.done_weekend": "Το Σαββατοκύριακο ορίστηκε ως διαθέσιμο.",
  "promoters.availability.bulk.done_clear_all": "Το δεκαπενθήμερο καθαρίστηκε.",

  /* --- P31: brief acknowledgement --- */
  "invitation.brief.title": "Brief",
  "invitation.brief.confirm": "Το διάβασα",
  "invitation.brief.acknowledged_on": "Το διάβασες: {date}",
  "invitation.brief.error": "Δεν μπορέσαμε να το καταγράψουμε. Δοκίμασε ξανά.",

  "campaigns.brief.roster.title": "Ποιοι έχουν διαβάσει το brief",
  "campaigns.brief.roster.column.promoter": "Promoter",
  "campaigns.brief.roster.column.acknowledged_at": "Το διάβασε στις",
  "campaigns.brief.roster.pending_title": "Δεν το έχουν διαβάσει ακόμα",
  "campaigns.brief.roster.acknowledged_title": "Το έχουν διαβάσει",
  "campaigns.brief.roster.empty_pending": "Όλοι οι προγραμματισμένοι promoters έχουν διαβάσει το brief.",
  "campaigns.brief.roster.empty_acknowledged": "Δεν το έχει διαβάσει κανείς ακόμα.",
  "campaigns.brief.roster.no_staff": "Δεν έχει προγραμματιστεί καμία promoter σε αυτή την καμπάνια ακόμα.",
  "campaigns.brief.roster.not_published":
    "Το brief δεν έχει δημοσιευτεί ακόμα — καμία promoter δεν μπορεί να το διαβάσει.",

  "promoters.availability.bulk.clear_all_confirm": "Σίγουρα; Πάτησε ξανά για να σβήσεις",
  "promoters.availability.bulk.clear_all_cancel": "Άκυρο",
  "promoters.availability.bulk.clear_all_warning":
    "Θα σβηστούν και οι δεκατέσσερις μέρες. Δεν γίνεται αναίρεση.",
  "promoters.availability.bulk.clear_all_warning_self":
    "Προσοχή: κάποιες από αυτές τις μέρες τις δήλωσε η ίδια η promoter. Θα σβηστούν κι αυτές, χωρίς αναίρεση.",

  /* --- P35b: the detail screens — badges for a raw assignment status, never printed verbatim --- */
  "promoters.profile.assignment_status.confirmed": "Επιβεβαιωμένη",
  "promoters.profile.assignment_status.completed": "Ολοκληρωμένη",
  "promoters.profile.assignment_status.cancelled": "Ακυρωμένη",
  "promoters.profile.assignment_status.no_show": "Μη προσέλευση",

  /* --- P35c: forms and settings craft pass — no field/behaviour change, composition only --- */
  "promoters.new.back": "← Promoters",
  "campaigns.new.section_details": "Στοιχεία καμπάνιας",

  "page_title.settings": "Ρυθμίσεις",
  "page_title.settings_team": "Ομάδα",
  "page_title.settings_agency": "Στοιχεία γραφείου",
  "page_title.settings_billing": "Συνδρομή",
  "page_title.onboarding": "Καλωσόρισες",
  "page_title.onboarding_join": "Πρόσκληση",

  "copy.copied": "Αντιγράφηκε",
  "copy.blocked":
    "Ο browser δεν επέτρεψε την αντιγραφή. Άνοιξε τη σελίδα σε Chrome ή Safari και δοκίμασε ξανά.",
  "copy.blocked_selected":
    "Ο browser δεν επέτρεψε την αντιγραφή. Το κείμενο επιλέχτηκε — πάτα Ctrl+C, ή κράτα το δάχτυλο πάνω του στο κινητό.",
  "whatsapp.open": "Άνοιγμα στο WhatsApp",

  /* --- P37a: shift sections ("ενότητες") on /shifts --- */
  "shifts.sections.new_button": "Νέα ενότητα",
  "shifts.sections.new.title": "Νέα ενότητα",
  "shifts.sections.new.name_label": "Όνομα ενότητας",
  "shifts.sections.new.campaign_label": "Καμπάνια",
  "shifts.sections.new.campaign_placeholder": "Επίλεξε καμπάνια",
  "shifts.sections.new.no_campaigns_hint": "Δεν υπάρχει ακόμα καμία καμπάνια — φτιάξε πρώτα μία.",
  "shifts.sections.new.submit": "Δημιουργία",
  "shifts.sections.new.submitting": "Δημιουργία…",
  "shifts.sections.new.cancel": "Άκυρο",
  "shifts.sections.validation.campaign_required": "Επίλεξε καμπάνια.",
  "shifts.sections.validation.name_invalid": "Δώσε ένα όνομα έως 120 χαρακτήρες.",
  "shifts.sections.error.save_failed": "Δεν αποθηκεύτηκε. Δοκίμασε ξανά.",
  "shifts.sections.error.blocked_read_only":
    "Ο λογαριασμός είναι μόνο για ανάγνωση αυτή τη στιγμή, οπότε δεν μπορείς να αλλάξεις ενότητες.",

  "shifts.sections.rename_button": "Μετονομασία",
  "shifts.sections.rename.name_label": "Όνομα ενότητας",
  "shifts.sections.rename.save": "Αποθήκευση",
  "shifts.sections.rename.cancel": "Άκυρο",

  "shifts.sections.archive_button": "Αρχειοθέτηση",
  "shifts.sections.unarchive_button": "Επαναφορά",
  "shifts.sections.archived_badge": "Αρχειοθετημένη",

  "shifts.sections.import_badge": "Excel: {filename}",
  "shifts.sections.date_range": "{from} – {to}",
  "shifts.sections.date_range_none": "Δεν έχουν οριστεί ημερομηνίες ακόμα",
  "shifts.sections.next_shift": "Επόμενη: {date}",
  "shifts.sections.next_shift_none": "Καμία προσεχής βάρδια",
  "shifts.sections.needs_people_one": "{count} βάρδια χρειάζεται ακόμα άτομα",
  "shifts.sections.needs_people_many": "{count} βάρδιες χρειάζονται ακόμα άτομα",
  "shifts.sections.needs_people_none": "Πλήρως στελεχωμένη",
  "shifts.sections.needs_people_empty": "Καμία βάρδια ακόμα",
  "shifts.sections.add_shifts": "Προσθήκη βαρδιών",
  "shifts.sections.shifts_toggle_one": "Βάρδια ({count})",
  "shifts.sections.shifts_toggle_many": "Βάρδιες ({count})",
  "shifts.sections.shifts_empty": "Καμία βάρδια σε αυτή την ενότητα ακόμα.",

  "shifts.sections.unsectioned_title": "Χωρίς ενότητα",
  "shifts.sections.unsectioned_description":
    "Βάρδιες που δημιουργήθηκαν εκτός των παραπάνω ενοτήτων.",

  "shifts.sections.filters.client_label": "Πελάτης",
  "shifts.sections.filters.client_all": "Όλοι οι πελάτες",
  "shifts.sections.filters.campaign_label": "Καμπάνια",
  "shifts.sections.filters.campaign_all": "Όλες οι καμπάνιες",
  "shifts.sections.filters.when_label": "Χρονικό διάστημα",
  "shifts.sections.filters.when_all": "Όλες",
  "shifts.sections.filters.when_upcoming": "Προσεχείς",
  "shifts.sections.filters.when_past": "Παρελθοντικές",
  "shifts.sections.filters.show_archived": "Εμφάνιση αρχειοθετημένων",

  "shifts.sections.empty.title": "Καμία ενότητα ακόμα",
  "shifts.sections.empty.body":
    "Φτιάξε την πρώτη ενότητα βαρδιών με το χέρι, ή άφησε το αρχείο Excel ενός πελάτη πάνω στη σελίδα για να δημιουργηθούν αυτόματα.",
  "shifts.sections.empty.cta": "Νέα ενότητα",
  "shifts.sections.filtered_empty.title": "Καμία ενότητα δεν ταιριάζει με τα φίλτρα",
  "shifts.sections.filtered_empty.body": "Δοκίμασε διαφορετικά φίλτρα, ή καθάρισέ τα.",
  "shifts.sections.filtered_empty.cta": "Καθαρισμός φίλτρων",

  "campaigns.shifts_new.section_programme": "Ενότητα",
  "campaigns.shifts_new.programme_existing": "Υπάρχουσα ενότητα",
  "campaigns.shifts_new.programme_new": "Νέα ενότητα",
  "campaigns.shifts_new.programme_select_label": "Ενότητα",
  "campaigns.shifts_new.programme_select_placeholder": "Επίλεξε ενότητα",
  "campaigns.shifts_new.new_programme_name_label": "Όνομα νέας ενότητας",
  "campaigns.shifts_new.no_programmes_hint":
    "Δεν υπάρχει ακόμα καμία ενότητα σε αυτή την καμπάνια — φτιάξε την πρώτη παρακάτω.",
  "campaigns.validation.programme_required": "Επίλεξε ενότητα.",
  "campaigns.validation.new_programme_name": "Δώσε ένα όνομα έως 120 χαρακτήρες.",
  "campaigns.shifts_new.error.programme_save_failed":
    "Δεν μπορέσαμε να αποθηκεύσουμε τη νέα ενότητα. Δοκίμασε ξανά.",

  /* --- P38: "Στείλε πρόσκληση" από την καρτέλα promoter, σε οποιαδήποτε βάρδια --- */
  "promoters.profile.invite_button": "Στείλε πρόσκληση",

  "invite_panel.title": "Στείλε πρόσκληση",
  "invite_panel.subtitle": "Διάλεξε μια βάρδια για την {name}.",
  "invite_panel.filter.campaign_label": "Καμπάνια",
  "invite_panel.filter.campaign_all": "Όλες οι καμπάνιες",
  "invite_panel.filter.date_label": "Ημερομηνία",
  "invite_panel.filter.clear": "Καθαρισμός φίλτρων",
  "invite_panel.empty_no_shifts":
    "Δεν υπάρχουν επερχόμενες βάρδιες που να χρειάζονται άτομα αυτή τη στιγμή.",
  "invite_panel.empty_filtered": "Καμία βάρδια δεν ταιριάζει με αυτά τα φίλτρα.",
  "invite_panel.slots_needed": "Θέσεις προς κάλυψη: {count}",
  "invite_panel.send.button": "Αποστολή πρόσκλησης",
  "invite_panel.send.sent": "Στάλθηκε",
  "invite_panel.send.error.missing_ids": "Λείπουν στοιχεία στη φόρμα. Φόρτωσε ξανά τη σελίδα.",
  "invite_panel.send.error.not_found": "Δεν βρέθηκε.",
  "invite_panel.send.error.blocked_read_only":
    "Ο λογαριασμός είναι μόνο για ανάγνωση αυτή τη στιγμή, οπότε δεν μπορείς να στείλεις νέες προσκλήσεις. Δες τη Χρέωση στις Ρυθμίσεις για να συνεχίσεις.",
  "invite_panel.send.error.unknown": "Κάτι πήγε στραβά. Δοκίμασε ξανά.",

  /* Οι ίδιοι λόγοι που ο κινητήρας αντιστοίχισης εφαρμόζει ως σκληρά φίλτρα ή προσαρμόζει τη
     βαθμολογία — εδώ ρητά δηλωμένοι, ώστε η coordinator να παρακάμπτει τη μηχανή εν γνώσει της. */
  "invite_eligibility.blocking.archived": "Η promoter είναι αρχειοθετημένη.",
  "invite_eligibility.blocking.blocklisted": "Η promoter είναι αποκλεισμένη.",
  "invite_eligibility.blocking.already_confirmed": "Είναι ήδη επιβεβαιωμένη σε αυτή τη βάρδια.",
  "invite_eligibility.blocking.pending_invitation":
    "Έχει ήδη ανοιχτή πρόσκληση για αυτή τη βάρδια.",
  "invite_eligibility.blocking.overlapping_confirmed_shift":
    "Είναι ήδη επιβεβαιωμένη σε άλλη βάρδια που συμπίπτει χρονικά.",
  "invite_eligibility.blocking.shift_unavailable": "Η βάρδια δεν χρειάζεται πλέον άτομα.",
  "invite_eligibility.warning.no_availability_declared":
    "Δεν έχει δηλώσει διαθεσιμότητα για αυτή την ημέρα.",
  "invite_eligibility.warning.declared_unavailable":
    "Έχει δηλώσει μη διαθεσιμότητα που καλύπτει (μέρος ή όλη) αυτή τη βάρδια.",
  "invite_eligibility.warning.outside_travel_radius": "Είναι εκτός της συνήθους ακτίνας μετακίνησης.",
  "invite_eligibility.warning.brief_not_read": "Δεν έχει διαβάσει ακόμα το brief της καμπάνιας.",

  /* --- P38: ο σύνδεσμος check-in φτάνει τελικά στην promoter --- */
  "invitation.next_steps.title": "Τι ακολουθεί",
  "invitation.next_steps.body":
    "Την ημέρα της βάρδιας, όταν φτάσεις στο κατάστημα, άνοιξε αυτόν τον σύνδεσμο για να δηλώσεις άφιξη. Μπορείς να ξαναβρείς αυτή τη σελίδα όποτε θέλεις.",
  "invitation.next_steps.open_checkin": "Άνοιγμα σελίδας άφιξης",
  "invitation.next_steps.error":
    "Δεν μπορέσαμε να ετοιμάσουμε τον σύνδεσμο άφιξης αυτή τη στιγμή. Δοκίμασε ξανά αργότερα.",

  "shifts.board.checkin_link_action": "Σύνδεσμος check-in",
  "shifts.board.checkin_link.message.greeting": "Γεια σου {name}!",
  "shifts.board.checkin_link.message.body": "Δήλωσε άφιξη όταν φτάσεις στο κατάστημα:",
  /* --- P39: automatic messaging — email adapter, dispatch, /settings/messaging --- */
  "page_title.settings_messaging": "Αυτόματα μηνύματα",
  "settings.card.messaging_title": "Αυτόματα μηνύματα",
  "settings.card.messaging_body":
    "Ο σύνδεσμος διαθεσιμότητας φεύγει μόνος του με email: όταν προσθέτεις promoter, και σε όλες την 1η και τη 15η του μήνα.",
  "settings.card.messaging_cta": "Ρυθμίσεις αποστολής",

  "messaging.email.default_subject": "Μήνυμα από το γραφείο σου",
  "messaging.email.default_action": "Άνοιγμα",
  "messaging.email.link_fallback": "Αν το κουμπί δεν ανοίγει, πάτα ή αντέγραψε αυτόν τον σύνδεσμο:",
  "messaging.email.automated_note":
    "Αυτό το email στάλθηκε αυτόματα — μην απαντήσεις εδώ. Για οποιαδήποτε αλλαγή, μίλησε με τον συντονιστή σου.",
  "messaging.email.availability.subject_welcome": "Καλώς ήρθες — δήλωσε πότε μπορείς να δουλέψεις",
  "messaging.email.availability.subject_periodic": "Ενημέρωσε τη διαθεσιμότητά σου",
  "messaging.email.availability.action": "Δήλωση διαθεσιμότητας",
  "messaging.email.checkin.subject": "Η βάρδιά σου σήμερα στις {start}",
  "messaging.email.checkin.action": "Check-in",
  "messaging.email.invitation.subject": "Νέα βάρδια για σένα",
  "messaging.email.invitation.action": "Δες τη βάρδια",

  "messaging.availability.welcome_intro": "Το {agency} σε πρόσθεσε στους promoters του.",
  "messaging.availability.welcome_intro_no_agency": "Σε προσθέσαμε στους promoters του γραφείου.",
  "messaging.availability.periodic_intro": "Ήρθε η ώρα να ενημερώσεις το {agency} για τη διαθεσιμότητά σου.",
  "messaging.availability.periodic_intro_no_agency": "Ήρθε η ώρα να ενημερώσεις τη διαθεσιμότητά σου.",
  "messaging.checkin.today": "Σήμερα έχεις βάρδια: {where}, {start}–{end}.",
  "messaging.checkin.instruction": "Όταν φτάσεις στο κατάστημα, άνοιξε αυτόν τον σύνδεσμο για check-in:",

  "messaging.title": "Αυτόματα μηνύματα",
  "messaging.subtitle":
    "Τι στέλνεται μόνο του στις promoters, πώς πήγε η τελευταία αποστολή, και ποιες πρέπει να ειδοποιήσεις εσύ.",
  "messaging.back_to_settings": "← Ρυθμίσεις",

  "messaging.migration_missing.title": "Η αυτόματη αποστολή δεν έχει ενεργοποιηθεί ακόμα στη βάση",
  "messaging.migration_missing.body":
    "Λείπει η ενημέρωση της βάσης δεδομένων (0017). Μέχρι να γίνει, δεν στέλνεται και δεν καταγράφεται τίποτα αυτόματα.",
  "messaging.not_configured.title": "Το email δεν έχει ρυθμιστεί",
  "messaging.not_configured.body":
    "Χωρίς email δεν μπορεί να σταλεί τίποτα αυτόματα, οπότε όλες οι promoters είναι στη λίστα παρακάτω για αποστολή με το χέρι. Λείπουν: {vars}.",

  "messaging.auto.title": "Σύνδεσμος διαθεσιμότητας",
  "messaging.auto.description":
    "Στέλνεται με email σε κάθε νέα promoter μόλις την προσθέσεις, και ξανά σε όλες τις ενεργές την 1η και τη 15η κάθε μήνα.",
  "messaging.auto.state_on": "Η αυτόματη αποστολή είναι ανοιχτή",
  "messaging.auto.state_off": "Η αυτόματη αποστολή είναι κλειστή",
  "messaging.auto.turn_on": "Ενεργοποίηση",
  "messaging.auto.turn_off": "Απενεργοποίηση",
  "messaging.auto.owner_only": "Μόνο ο ιδιοκτήτης του λογαριασμού μπορεί να την αλλάξει.",
  "messaging.auto.next_run": "Επόμενη αυτόματη αποστολή: {date}.",
  "messaging.auto.next_run_off": "Δεν θα σταλεί τίποτα αυτόματα μέχρι να την ενεργοποιήσεις ξανά.",

  "messaging.last_run.title": "Τελευταία αποστολή",
  "messaging.last_run.scheduled": "προγραμματισμένη",
  "messaging.last_run.manual": "χειροκίνητη",
  "messaging.last_run.sent": "Στάλθηκαν",
  "messaging.last_run.no_email": "Χωρίς email",
  "messaging.last_run.reserved_domain": "Δοκιμαστικό email",
  "messaging.last_run.failed": "Απέτυχαν",
  "messaging.last_run.pending": "{count} ακόμα σε εξέλιξη — ανανέωσε τη σελίδα σε λίγο.",
  "messaging.last_run.none": "Δεν έχει γίνει ακόμα καμία αποστολή.",

  "messaging.send_now.button": "Στείλε τώρα σε όλους",
  "messaging.send_now.confirm_title": "Θα σταλεί email σε {count} promoters.",
  "messaging.send_now.confirm_already": "{count} το πήραν ήδη σήμερα και δεν θα το ξαναπάρουν.",
  "messaging.send_now.confirm_unreachable":
    "{count} δεν έχουν email που να μπορεί να σταλεί — είναι στη λίστα παρακάτω.",
  "messaging.send_now.confirm_once": "Ό,τι κι αν γίνει, καμία δεν θα πάρει το ίδιο email δύο φορές σήμερα.",
  "messaging.send_now.confirm": "Αποστολή σε {count}",
  "messaging.send_now.started":
    "Η αποστολή σε {count} promoters ξεκίνησε. Θέλει περίπου μισό δευτερόλεπτο ανά email — ανανέωσε τη σελίδα σε λίγο για τα αποτελέσματα.",
  "messaging.send_now.nobody": "Καμία ενεργή promoter δεν έχει email που να μπορεί να σταλεί.",
  "messaging.send_now.all_sent_today": "Όλες όσες έχουν email το πήραν ήδη σήμερα.",
  "messaging.send_now.owner_only": "Την αποστολή σε όλους μπορεί να την κάνει μόνο ο ιδιοκτήτης του λογαριασμού.",
  "messaging.send_now.needs_email": "Η αποστολή σε όλους γίνεται μόλις ρυθμιστεί το email.",
  "messaging.send_now.needs_migration": "Η αποστολή σε όλους γίνεται μόλις ενημερωθεί η βάση δεδομένων.",

  "messaging.unreachable.title": "Στείλε τα εσύ",
  "messaging.unreachable.description":
    "Σε αυτές το email δεν μπορεί να φτάσει. Ο σύνδεσμός τους είναι έτοιμος — στείλε τον στο WhatsApp ή αντέγραψέ τον.",
  "messaging.unreachable.description_no_email":
    "Χωρίς ρυθμισμένο email, κάθε promoter χρειάζεται τον σύνδεσμο από εσένα. Είναι έτοιμος για την καθεμία.",
  "messaging.unreachable.none": "Όλες οι ενεργές promoters μπορούν να λάβουν τον σύνδεσμο αυτόματα.",
  "messaging.unreachable.no_promoters": "Δεν υπάρχουν ακόμα ενεργές promoters.",
  "messaging.unreachable.search_label": "Αναζήτηση στη λίστα",
  "messaging.unreachable.search_placeholder": "Όνομα ή τηλέφωνο",
  "messaging.unreachable.search_count": "{shown} από {total}",
  "messaging.unreachable.search_empty_title": "Κανένα αποτέλεσμα",
  "messaging.unreachable.search_empty_body": "Δοκίμασε άλλο όνομα ή τηλέφωνο.",
  "messaging.unreachable.link_label": "Σύνδεσμος διαθεσιμότητας για {name}",
  "messaging.unreachable.fix_email": "Διόρθωση email",

  "messaging.reason.email_not_configured": "Χωρίς email αποστολής",
  "messaging.reason.no_email": "Δεν έχει email",
  "messaging.reason.invalid_email": "Λάθος email",
  "messaging.reason.reserved_domain": "Δοκιμαστικό email — δεν στέλνεται",
  "messaging.reason.last_send_failed": "Η τελευταία αποστολή απέτυχε",

  "messaging.errors.not_owner": "Μόνο ο ιδιοκτήτης του λογαριασμού μπορεί να το κάνει αυτό.",
  "messaging.errors.migration_missing":
    "Η βάση δεδομένων δεν έχει ενημερωθεί ακόμα για την αυτόματη αποστολή (0017). Δεν στάλθηκε τίποτα.",
  "messaging.errors.email_not_configured": "Το email δεν έχει ρυθμιστεί, οπότε δεν στάλθηκε τίποτα.",
  "messaging.errors.write_not_permitted":
    "Η βάση δεν επέτρεψε την αλλαγή. Αν είσαι ιδιοκτήτης, η ενημέρωση 0017 μάλλον δεν έχει εφαρμοστεί.",
  "messaging.errors.unknown": "Δεν ήταν δυνατή η ενέργεια. Ανανέωσε τη σελίδα και δοκίμασε ξανά.",

  "shifts.invite.delivered": "Στάλθηκε με email",
  "shifts.invite.failed": "Η πρόσκληση δεν στάλθηκε. Δοκίμασε ξανά σε λίγο.",
  // P37c — Excel import (app/shifts/import)
  "shifts.import.button": "Εισαγωγή από Excel",
  "shifts.import.button_hint": "Διάλεξε το αρχείο του πελάτη ή σύρε το οπουδήποτε στη σελίδα",
  "shifts.import.button_section": "Από Excel",
  "shifts.import.button_section_hint": "Εισαγωγή βαρδιών από Excel στην ενότητα «{section}»",
  "shifts.import.drop.title": "Άφησε το αρχείο εδώ",
  "shifts.import.drop.body": "Excel (.xlsx, .xls), OpenDocument (.ods) ή CSV. Τίποτα δεν δημιουργείται πριν το ελέγξεις.",
  "shifts.import.file.wrong_type": "Αυτό δεν είναι αρχείο που μπορεί να διαβαστεί. Χρειάζεται Excel (.xlsx, .xls), .ods ή .csv.",
  "shifts.import.file.too_large": "Το αρχείο είναι πολύ μεγάλο. Το όριο είναι {max} MB.",
  "shifts.import.file.too_many_rows": "Το αρχείο έχει πάνω από 2000 γραμμές σε ένα φύλλο. Χώρισέ το σε μικρότερα αρχεία.",
  "shifts.import.file.empty": "Το αρχείο είναι άδειο — δεν βρέθηκαν δεδομένα.",
  "shifts.import.file.unreadable": "Το αρχείο δεν μπόρεσε να διαβαστεί. Άνοιξέ το στο Excel, αποθήκευσέ το ξανά ως .xlsx και δοκίμασε πάλι.",
  "shifts.import.file.load_failed": "Η εισαγωγή δεν φόρτωσε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.",
  "shifts.import.title": "Εισαγωγή βαρδιών από Excel",
  "shifts.import.title_section": "Εισαγωγή στην ενότητα «{section}»",
  "shifts.import.step_of": "Βήμα {step} από {total}",
  "shifts.import.step.columns": "Στήλες",
  "shifts.import.step.destination": "Πού πάνε οι βάρδιες",
  "shifts.import.step.stores": "Καταστήματα",
  "shifts.import.step.preview": "Έλεγχος",
  "shifts.import.step.done": "Ολοκληρώθηκε",
  "shifts.import.close": "Κλείσιμο",
  "shifts.import.close_confirm": "Να κλείσει η εισαγωγή; Οι επιλογές σου θα χαθούν. Δεν έχει δημιουργηθεί τίποτα.",
  "shifts.import.close_confirm_yes": "Ναι, κλείσιμο",
  "shifts.import.close_confirm_no": "Συνέχισε την εισαγωγή",
  "shifts.import.back": "Πίσω",
  "shifts.import.next": "Επόμενο",
  "shifts.import.retry": "Δοκίμασε ξανά",
  "shifts.import.context_failed": "Δεν φόρτωσαν οι καμπάνιες και τα καταστήματά σου. Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.columns.title": "Έτσι διαβάστηκαν οι στήλες",
  "shifts.import.columns.description": "Έλεγξε ότι κάθε στήλη σημαίνει αυτό που γράφει δίπλα της. Όσες είναι κίτρινες χρειάζονται μια ματιά. Μπορείς να αλλάξεις οποιαδήποτε.",
  "shifts.import.columns.remembered": "Χρησιμοποιήθηκε η αντιστοίχιση από την προηγούμενη φορά.",
  "shifts.import.columns.forget": "Διάβασε τις στήλες από την αρχή",
  "shifts.import.columns.sheet_label": "Φύλλο",
  "shifts.import.columns.header_row_label": "Οι επικεφαλίδες είναι στη γραμμή",
  "shifts.import.columns.header_row_hint": "Άλλαξέ το μόνο αν οι στήλες παρακάτω δεν έχουν τα σωστά ονόματα.",
  "shifts.import.columns.header_row_option": "Γραμμή {row}: {preview}",
  "shifts.import.columns.missing": "Για να γίνει εισαγωγή λείπει: {fields}. Διάλεξε ποια στήλη το έχει.",
  "shifts.import.columns.required.date": "ημερομηνία",
  "shifts.import.columns.required.store_name": "κατάστημα",
  "shifts.import.columns.required.time": "ώρα (ωράριο, ή έναρξη και λήξη)",
  "shifts.import.columns.review_one": "1 στήλη διαβάστηκε με αβεβαιότητα — έλεγξέ τη.",
  "shifts.import.columns.review_other": "{count} στήλες διαβάστηκαν με αβεβαιότητα — έλεγξέ τες.",
  "shifts.import.columns.review_badge": "Έλεγξε",
  "shifts.import.columns.rows_found_one": "Βρέθηκε 1 γραμμή με δεδομένα.",
  "shifts.import.columns.rows_found_other": "Βρέθηκαν {count} γραμμές με δεδομένα.",
  "shifts.import.columns.untitled": "Χωρίς τίτλο",
  "shifts.import.columns.meaning_label": "Η στήλη {column} σημαίνει",
  "shifts.import.columns.samples": "Παραδείγματα από το αρχείο",
  "shifts.import.columns.no_samples": "Άδεια στήλη",
  "shifts.import.columns.blocked": "Διάλεξε πρώτα τις στήλες που λείπουν.",
  "shifts.import.columns.no_rows": "Κάτω από τις επικεφαλίδες δεν υπάρχουν γραμμές.",
  "shifts.import.columns.too_many": "Πάνω από {max} γραμμές — χώρισε το αρχείο.",
  "shifts.import.field.date": "Ημερομηνία",
  "shifts.import.field.store_name": "Κατάστημα",
  "shifts.import.field.store_address": "Διεύθυνση καταστήματος",
  "shifts.import.field.city": "Περιοχή / πόλη",
  "shifts.import.field.chain": "Αλυσίδα",
  "shifts.import.field.start_time": "Ώρα έναρξης",
  "shifts.import.field.end_time": "Ώρα λήξης",
  "shifts.import.field.time_range": "Ωράριο (π.χ. 10:00-18:00)",
  "shifts.import.field.promoters_required": "Άτομα",
  "shifts.import.field.notes": "Σημειώσεις (δεν αποθηκεύονται)",
  "shifts.import.field.ignore": "Δεν χρησιμοποιείται",
  "shifts.import.destination.campaign_title": "Καμπάνια",
  "shifts.import.destination.campaign_description": "Κάθε βάρδια ανήκει σε μια καμπάνια. Διάλεξε μια υπάρχουσα ή φτιάξε νέα.",
  "shifts.import.destination.campaign_existing": "Υπάρχουσα καμπάνια",
  "shifts.import.destination.campaign_new": "Νέα καμπάνια",
  "shifts.import.destination.campaign_label": "Καμπάνια",
  "shifts.import.destination.campaign_placeholder": "Διάλεξε καμπάνια",
  "shifts.import.destination.client_title": "Πελάτης",
  "shifts.import.destination.client_existing": "Υπάρχων πελάτης",
  "shifts.import.destination.client_new": "Νέος πελάτης",
  "shifts.import.destination.client_label": "Πελάτης",
  "shifts.import.destination.client_placeholder": "Διάλεξε πελάτη",
  "shifts.import.destination.client_name_label": "Όνομα πελάτη",
  "shifts.import.destination.campaign_name_label": "Όνομα καμπάνιας",
  "shifts.import.destination.starts_on": "Από",
  "shifts.import.destination.ends_on": "Έως",
  "shifts.import.destination.rate_label": "Αμοιβή ανά βάρδια (€)",
  "shifts.import.destination.rate_hint": "π.χ. 45 ή 45,50",
  "shifts.import.destination.dates_from_file": "Οι ημερομηνίες συμπληρώθηκαν από την πρώτη και την τελευταία ημερομηνία του αρχείου.",
  "shifts.import.destination.section_title": "Ενότητα",
  "shifts.import.destination.section_description": "Οι βάρδιες του αρχείου εμφανίζονται μαζί, σε μια ενότητα της σελίδας Βάρδιες.",
  "shifts.import.destination.section_existing": "Σε υπάρχουσα ενότητα",
  "shifts.import.destination.section_new": "Νέα ενότητα",
  "shifts.import.destination.section_label": "Ενότητα",
  "shifts.import.destination.section_name_label": "Όνομα νέας ενότητας",
  "shifts.import.destination.section_name_hint": "Προτάθηκε από το όνομα του αρχείου.",
  "shifts.import.destination.sections_unavailable": "Οι υπάρχουσες ενότητες δεν φόρτωσαν, οπότε προσφέρεται μόνο νέα ενότητα.",
  "shifts.import.destination.problem.campaign": "Διάλεξε καμπάνια.",
  "shifts.import.destination.problem.client": "Διάλεξε πελάτη.",
  "shifts.import.destination.problem.client_name": "Γράψε το όνομα του πελάτη.",
  "shifts.import.destination.problem.client_exists": "Ο πελάτης «{name}» υπάρχει ήδη — διάλεξέ τον από τη λίστα «Υπάρχων πελάτης».",
  "shifts.import.destination.problem.campaign_name": "Γράψε όνομα καμπάνιας (τουλάχιστον 2 χαρακτήρες).",
  "shifts.import.destination.problem.dates": "Συμπλήρωσε ημερομηνίες έναρξης και λήξης της καμπάνιας.",
  "shifts.import.destination.problem.date_order": "Η λήξη της καμπάνιας είναι πριν από την έναρξη.",
  "shifts.import.destination.problem.rate": "Γράψε την αμοιβή, π.χ. 45 ή 45,50.",
  "shifts.import.destination.problem.section": "Διάλεξε ενότητα.",
  "shifts.import.destination.problem.section_name": "Γράψε όνομα ενότητας (έως 120 χαρακτήρες).",
  "shifts.import.stores.title": "Καταστήματα",
  "shifts.import.stores.found_one": "Στο αρχείο υπάρχει 1 κατάστημα.",
  "shifts.import.stores.found_other": "Στο αρχείο υπάρχουν {count} διαφορετικά καταστήματα.",
  "shifts.import.stores.need_one": "1 χρειάζεται απόφαση.",
  "shifts.import.stores.need_other": "{count} χρειάζονται απόφαση.",
  "shifts.import.stores.none": "Καμία γραμμή του αρχείου δεν μπορεί να γίνει βάρδια. Στο επόμενο βήμα φαίνεται τι λείπει σε κάθε γραμμή.",
  "shifts.import.stores.rows_one": "1 βάρδια",
  "shifts.import.stores.rows_other": "{count} βάρδιες",
  "shifts.import.stores.badge.exact": "Βρέθηκε",
  "shifts.import.stores.badge.likely": "Πιθανή αντιστοιχία",
  "shifts.import.stores.badge.undecided": "Χρειάζεται απόφαση",
  "shifts.import.stores.badge.chosen": "Επιλέχθηκε",
  "shifts.import.stores.change": "Αλλαγή",
  "shifts.import.stores.choice_legend": "Τι να γίνει με το «{name}»",
  "shifts.import.stores.likely_compare": "Στο αρχείο: {file} — Στη βάση: {existing}",
  "shifts.import.stores.likely_hint": "Μοιάζει με το «{store}». Βεβαιώσου ότι είναι το ίδιο κατάστημα.",
  "shifts.import.stores.use_existing": "Είναι υπάρχον κατάστημα",
  "shifts.import.stores.existing_label": "Κατάστημα",
  "shifts.import.stores.create": "Νέο κατάστημα, με τα στοιχεία του αρχείου",
  "shifts.import.stores.locating": "Αναζήτηση της διεύθυνσης…",
  "shifts.import.stores.located": "Θα τοποθετηθεί στο: {address}",
  "shifts.import.stores.located_low": "Η θέση είναι αβέβαιη. Αν δεν είναι σωστή, τα check-in εκεί θα βγαίνουν εκτός περιμέτρου — προτίμησε υπάρχον κατάστημα αν υπάρχει.",
  "shifts.import.stores.unplaceable": "Η διεύθυνση δεν βρέθηκε στον χάρτη, οπότε αυτό το κατάστημα δεν μπορεί να δημιουργηθεί. Διάλεξε υπάρχον κατάστημα ή παράλειψη.",
  "shifts.import.stores.skip_one": "Παράλειψη — η 1 γραμμή δεν θα εισαχθεί",
  "shifts.import.stores.skip_other": "Παράλειψη — οι {count} γραμμές δεν θα εισαχθούν",
  "shifts.import.stores.problem.undecided_one": "1 κατάστημα χρειάζεται απόφαση.",
  "shifts.import.stores.problem.undecided_other": "{count} καταστήματα χρειάζονται απόφαση.",
  "shifts.import.stores.problem.locating": "Περίμενε να βρεθεί η διεύθυνση.",
  "shifts.import.stores.problem.unplaceable": "Δεν μπορεί να δημιουργηθεί: {names}. Διάλεξε υπάρχον κατάστημα ή παράλειψη.",
  "shifts.import.preview.title": "Έλεγχος πριν τη δημιουργία",
  "shifts.import.preview.destination": "Οι βάρδιες θα μπουν στην ενότητα «{section}». Δεν έχει δημιουργηθεί τίποτα ακόμα.",
  "shifts.import.preview.headline_one": "1 βάρδια θα δημιουργηθεί",
  "shifts.import.preview.headline_other": "{count} βάρδιες θα δημιουργηθούν",
  "shifts.import.preview.problems_one": "1 γραμμή δεν θα εισαχθεί",
  "shifts.import.preview.problems_other": "{count} γραμμές δεν θα εισαχθούν",
  "shifts.import.preview.warnings_one": "1 βάρδια θα δημιουργηθεί με σημείωση — δες τη στήλη Κατάσταση.",
  "shifts.import.preview.warnings_other": "{count} βάρδιες θα δημιουργηθούν με σημείωση — δες τη στήλη Κατάσταση.",
  "shifts.import.preview.new_stores_one": "Θα δημιουργηθεί 1 νέο κατάστημα: {names}",
  "shifts.import.preview.new_stores_other": "Θα δημιουργηθούν {count} νέα καταστήματα: {names}",
  "shifts.import.preview.checking_duplicates": "Έλεγχος για βάρδιες που υπάρχουν ήδη…",
  "shifts.import.preview.duplicates_failed": "Ο έλεγχος για βάρδιες που υπάρχουν ήδη απέτυχε, οπότε η εισαγωγή σταμάτησε εδώ. Πήγαινε Πίσω και ξανά Επόμενο για να ξαναδοκιμάσεις.",
  "shifts.import.preview.include_existing_one": "Εισαγωγή και της 1 βάρδιας που υπάρχει ήδη στην καμπάνια (ίδιο κατάστημα, μέρα και ώρες)",
  "shifts.import.preview.include_existing_other": "Εισαγωγή και των {count} βαρδιών που υπάρχουν ήδη στην καμπάνια (ίδιο κατάστημα, μέρα και ώρες)",
  "shifts.import.preview.include_in_file_one": "Εισαγωγή και της 1 γραμμής που επαναλαμβάνεται μέσα στο αρχείο",
  "shifts.import.preview.include_in_file_other": "Εισαγωγή και των {count} γραμμών που επαναλαμβάνονται μέσα στο αρχείο",
  "shifts.import.preview.only_problems": "Δείξε μόνο τις {count} γραμμές που θέλουν προσοχή",
  "shifts.import.preview.table_label": "Οι γραμμές του αρχείου",
  "shifts.import.preview.col.row": "Γραμμή",
  "shifts.import.preview.col.date": "Ημερομηνία",
  "shifts.import.preview.col.hours": "Ώρες",
  "shifts.import.preview.col.store": "Κατάστημα",
  "shifts.import.preview.col.people": "Άτομα",
  "shifts.import.preview.col.status": "Κατάσταση",
  "shifts.import.preview.status.ready": "Έτοιμη",
  "shifts.import.preview.status.warning": "Με σημείωση",
  "shifts.import.preview.status.error": "Δεν εισάγεται",
  "shifts.import.preview.status.skipped": "Παραλείπεται",
  "shifts.import.preview.status.excluded": "Διπλή — εκτός",
  "shifts.import.preview.new_store_badge": "νέο",
  "shifts.import.preview.read_only": "Ο λογαριασμός είναι σε λειτουργία μόνο ανάγνωσης, οπότε δεν μπορούν να δημιουργηθούν βάρδιες.",
  "shifts.import.preview.back_to_stores": "Πίσω στα καταστήματα",
  "shifts.import.preview.submit_none": "Καμία βάρδια για δημιουργία",
  "shifts.import.preview.submit_one": "Δημιουργία 1 βάρδιας στην ενότητα «{section}»",
  "shifts.import.preview.submit_other": "Δημιουργία {count} βαρδιών στην ενότητα «{section}»",
  "shifts.import.preview.submit_stores_one": "{shifts} και 1 νέου καταστήματος",
  "shifts.import.preview.submit_stores_other": "{shifts} και {count} νέων καταστημάτων",
  "shifts.import.preview.submitting": "Δημιουργία…",
  "shifts.import.reason.missing_date": "Λείπει η ημερομηνία",
  "shifts.import.reason.unparseable_date": "Η ημερομηνία δεν διαβάζεται",
  "shifts.import.reason.missing_store": "Λείπει το κατάστημα",
  "shifts.import.reason.missing_time": "Λείπει η ώρα",
  "shifts.import.reason.unparseable_time": "Η ώρα δεν διαβάζεται",
  "shifts.import.reason.end_before_start": "Η λήξη είναι πριν από την έναρξη",
  "shifts.import.reason.past_date": "Η ημερομηνία έχει περάσει",
  "shifts.import.reason.bad_headcount": "Τα άτομα δεν διαβάζονται — μπήκε 1",
  "shifts.import.reason.duplicate_in_file": "Επαναλαμβάνεται μέσα στο αρχείο",
  "shifts.import.reason.store_skipped": "Το κατάστημα παραλείφθηκε",
  "shifts.import.reason.duplicate_existing": "Υπάρχει ήδη στην καμπάνια",
  "shifts.import.error.read_only": "Ο λογαριασμός είναι σε λειτουργία μόνο ανάγνωσης. Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.error.invalid_payload": "Τα δεδομένα της εισαγωγής δεν ήταν έγκυρα. Δεν δημιουργήθηκε τίποτα — κλείσε και ξαναδοκίμασε με το αρχείο.",
  "shifts.import.error.too_many_rows": "Πάνω από 2000 γραμμές. Δεν δημιουργήθηκε τίποτα — χώρισε το αρχείο.",
  "shifts.import.error.campaign_not_found": "Η καμπάνια δεν βρέθηκε (ίσως διαγράφηκε). Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.error.client_not_found": "Ο πελάτης δεν βρέθηκε (ίσως διαγράφηκε). Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.error.client_exists": "Ο πελάτης υπάρχει ήδη. Διάλεξέ τον ως υπάρχοντα. Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.error.campaign_invalid": "Τα στοιχεία της νέας καμπάνιας δεν είναι σωστά. Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.error.programme_not_found": "Η ενότητα δεν βρέθηκε σε αυτή την καμπάνια. Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.error.programme_archived": "Η ενότητα είναι αρχειοθετημένη, οπότε οι βάρδιες δεν θα φαίνονταν. Επανάφερέ την πρώτα. Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.error.programme_name_invalid": "Το όνομα της ενότητας δεν είναι σωστό. Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.error.stores_changed": "Τα καταστήματα του αρχείου δεν ταιριάζουν πια με τις επιλογές σου. Έλεγξέ τα ξανά. Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.error.store_not_found": "Ένα από τα υπάρχοντα καταστήματα που διάλεξες δεν βρέθηκε. Διάλεξε ξανά. Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.error.geocode_failed": "Δεν βρέθηκε στον χάρτη: {names}. Διάλεξε υπάρχον κατάστημα ή παράλειψη. Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.error.nothing_to_import": "Δεν έμεινε καμία βάρδια για δημιουργία. Δεν δημιουργήθηκε τίποτα.",
  "shifts.import.error.already_imported": "Αυτό το αρχείο μόλις εισήχθη σε ενότητα με το ίδιο όνομα. Δεν δημιουργήθηκε τίποτα δεύτερη φορά.",
  "shifts.import.error.load_failed": "Κάτι απέτυχε πριν ολοκληρωθεί ο έλεγχος. Ανανέωσε τη σελίδα Βάρδιες για να δεις αν δημιουργήθηκε κάτι, και ξαναδοκίμασε.",
  "shifts.import.done.success_one": "Δημιουργήθηκε 1 βάρδια στην ενότητα «{section}»",
  "shifts.import.done.success_other": "Δημιουργήθηκαν {count} βάρδιες στην ενότητα «{section}»",
  "shifts.import.done.failed.client": "Η εισαγωγή σταμάτησε: ο νέος πελάτης δεν αποθηκεύτηκε.",
  "shifts.import.done.failed.campaign": "Η εισαγωγή σταμάτησε: η νέα καμπάνια δεν αποθηκεύτηκε.",
  "shifts.import.done.failed.store": "Η εισαγωγή σταμάτησε: ένα νέο κατάστημα δεν αποθηκεύτηκε.",
  "shifts.import.done.failed.programme": "Η εισαγωγή σταμάτησε: η νέα ενότητα δεν αποθηκεύτηκε.",
  "shifts.import.done.failed.shifts": "Η εισαγωγή σταμάτησε στη μέση: μέρος των βαρδιών δεν αποθηκεύτηκε.",
  "shifts.import.done.not_created_one": "1 βάρδια δεν δημιουργήθηκε.",
  "shifts.import.done.not_created_other": "{count} βάρδιες δεν δημιουργήθηκαν.",
  "shifts.import.done.partial_created_one": "1 βάρδια δημιουργήθηκε και βρίσκεται στην ενότητα «{section}».",
  "shifts.import.done.partial_created_other": "{count} βάρδιες δημιουργήθηκαν και βρίσκονται στην ενότητα «{section}».",
  "shifts.import.done.recover_section": "Για να ολοκληρώσεις, ρίξε ξανά το ίδιο αρχείο στην ίδια ενότητα: όσες βάρδιες υπάρχουν ήδη θα παραλειφθούν ως διπλές. Αν δεν τις θέλεις, αρχειοθέτησε την ενότητα.",
  "shifts.import.done.recover_nothing": "Καμία βάρδια δεν δημιουργήθηκε. Ό,τι αναφέρεται παρακάτω υπάρχει ήδη και μπορείς να το χρησιμοποιήσεις όταν ξαναδοκιμάσεις.",
  "shifts.import.done.created_title": "Δημιουργήθηκαν",
  "shifts.import.done.created_client": "Ο νέος πελάτης",
  "shifts.import.done.created_campaign": "Η καμπάνια «{name}»",
  "shifts.import.done.created_stores_one": "1 νέο κατάστημα: {names}",
  "shifts.import.done.created_stores_other": "{count} νέα καταστήματα: {names}",
  "shifts.import.done.created_section": "Η ενότητα «{section}»",
  "shifts.import.done.left_out_title": "Δεν εισήχθησαν",
  "shifts.import.done.left_out_line": "{count} × {reason}",
  "shifts.import.done.open_section": "Άνοιγμα της ενότητας",
  // P37c — Excel import, follow-up
  "shifts.import.done.recover_retry": "Δεν δημιουργήθηκε τίποτα. Μπορείς να ξαναδοκιμάσεις με το ίδιο αρχείο.",

  "invitation.dress_code": "Ενδυμασία",
  "invitation.rate": "Αμοιβή",

  "report.photos_preparing": "Ετοιμάζουμε τις φωτογραφίες…",
} as const;
