frappe.listview_settings['Purchase Order'] = {
    add_fields: ["status","per_received","per_billed"],

    get_indicator(doc) {
        if (
            doc.docstatus === 1 &&
            doc.per_received == 100
        ) {
            return [__("Receive"), "green"];
        }
        if (
            doc.docstatus === 1 &&
            doc.per_received >  0 &&
            doc.per_received < 100
        ) {
            return [__("Partially Receive"), "orange"];
        }
        if (
            doc.docstatus === 1 &&
            doc.per_received < 100 && doc.per_billed < 100 && doc.status!= "Closed"
        ) {
            return [__("Followup"), "orange"];
        }   
        // Default indicators
        if (doc.docstatus === 0) {
            return [__("Draft"), "red", "docstatus,=,0"];
        }

        if (doc.docstatus === 1) {

            if (doc.status === "Completed") {
                return [__("Completed"), "green", "status,=,Completed"];
            }

            if (doc.status === "Closed") {
                return [__("Closed"), "green", "status,=,Closed"];
            }

            return [__("Submitted"), "blue", "docstatus,=,1"];
        }

        if (doc.docstatus === 2) {
            return [__("Cancelled"), "red", "docstatus,=,2"];
        }
    },
    onload(listview) {
        const SECTION_FIELDS = {
            'Purchase Order': [
                'ID', 'Supplier', 'Date', 'Status', 'Mode of Dispatch', 'Courier Name', 'Zsystem Responsible Person',
                'Grand Total', 'Rounded Total (Company Currency)'
            ],
            'Items (Purchase Order Item) (1 row mandatory)': [
                'Item Code', 'Description', 'Item Group', 'UOM', 'Quantity', 'Rate', 'Amount', 'Brand'
            ],
            'Purchase Order Pricing Rule (Pricing Rule Detail)': [
                " "
            ]
        };

        function cleanText($el) {
            return $el.clone().children().remove().end().text().trim();
        }

        function normalize(str) {
            return (str || '').replace(/\s+/g, ' ').trim().toLowerCase();
        }

        const NORMALIZED_SECTIONS = {};
        Object.keys(SECTION_FIELDS).forEach(section => {
            NORMALIZED_SECTIONS[normalize(section)] = section;
        });

        function matchSection(text) {
            return NORMALIZED_SECTIONS[normalize(text)] || null;
        }

        function fieldMatches(section, label) {
            if (!section || !SECTION_FIELDS[section]) return false;
            let normLabel = normalize(label);
            return SECTION_FIELDS[section].some(f => normalize(f) === normLabel);
        }

        function applyDefaults($modal) {
            let currentSection = null;

            $modal.find('.modal-body *').each(function () {
                let $el = $(this);

                // Heading detection
                if ($el.find('input[type=checkbox]').length === 0
                    && !$el.hasClass('checkbox')
                    && $el.parents('.checkbox').length === 0) {

                    let clean = cleanText($el);
                    let matched = matchSection(clean);

                    if (matched) {
                        let childAlsoMatches = $el.children().toArray().some(c => {
                            return matchSection(cleanText($(c)));
                        });
                        if (!childAlsoMatches) {
                            currentSection = matched;
                            console.log('%c[Section] ->', 'color:blue', currentSection);
                        }
                    }
                }

                // Checkbox rows
                if ($el.hasClass('checkbox') && $el.find('input[type=checkbox]').length) {
                    let label = $el.find('label').text().trim();
                    let $checkbox = $el.find('input[type=checkbox]');

                    let allowed = fieldMatches(currentSection, label);
                    let isChecked = $checkbox.prop('checked');

                    console.log('  section:', currentSection, '| label:', JSON.stringify(label), '| allowed:', allowed);

                    if (allowed && !isChecked) {
                        $checkbox.prop('checked', true).trigger('change');
                    } else if (!allowed && isChecked && !$checkbox.prop('disabled')) {
                        $checkbox.prop('checked', false).trigger('change');
                    }
                }
            });
        }

        $(document).on('shown.bs.modal', '.modal', function () {
            let $modal = $(this);
            if ($modal.find('.modal-title').text().trim() !== 'Export Data') return;

            console.log('=== Export Data modal opened, running initial pass ===');
            applyDefaults($modal);

            const observer = new MutationObserver(() => {
                console.log('=== DOM changed, re-applying defaults ===');
                applyDefaults($modal);
            });

            observer.observe($modal.find('.modal-body')[0], {
                childList: true,
                subtree: true
            });

            $modal.one('hidden.bs.modal', function () {
                observer.disconnect();
            });
        });
    }
};