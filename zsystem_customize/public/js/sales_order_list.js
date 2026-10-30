frappe.listview_settings['Sales Order'] = {
    add_fields: ["status","per_delivered","per_billed"],

    get_indicator(doc) {
        // Return DC
        if (
            doc.docstatus === 1 &&
            doc.per_delivered >  0 &&
            doc.per_delivered < 100
        ) {
            return [__("Partially Deliver"), "orange"];
        }
        if (
            doc.docstatus === 1 &&
            doc.per_delivered < 100 && doc.per_billed < 100 && doc.status!= "Closed"
        ) {
            return [__("In Progress"), "orange"];
        }   
        // Default indicators
        if (doc.docstatus === 0) {
            return [__("Draft"), "red", "docstatus,=,0"];
        }

        if (doc.docstatus === 1) {

            if (doc.status === "Completed") {
                return [__("Completed"), "green", "status,=,Completed"];
            }
             if (doc.status === "To Deliver") {
                return [__("To Deliver"), "grey", "status,=,To Deliver"];
            }

            if (doc.status === "To Bill") {
                return [__("To Bill"), "orange", "status,=,To Bill"];
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
    refresh(listview) {
        listview.sort_by = "po_date";   // Fieldname
        listview.sort_order = "desc";   // or "asc"
    },
    
onload(listview) {

    const SECTION_FIELDS = {
        'Sales Order': [
            'ID',
            'Customer/Company Name',
            'Order Type',
            'Created Date',
            'Sales person',
            "Customer's Purchase Order No",
            "Customer's Purchase Order Date",
            'Status',
            'Grand Total',
            'Rounded Total (Company Currency)'
        ],

        'Items (Sales Order Item) (1 row mandatory)': [
            'Item Code',
            'Description',
            'Item Group',
            'UOM',
            'Quantity',
            'Balance Qty',
            'Delivered Qty',
            'Rate',
            'Amount',
            'Brand Name'
        ],

        'Packed Items (Packed Item)': [],

        'Sales Taxes and Charges (Sales Taxes and Charges)': []
    };

    function normalize(str) {
        return (str || '')
            .replace(/\*/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    const NORMALIZED_SECTIONS = {};

    Object.keys(SECTION_FIELDS).forEach(section => {
        NORMALIZED_SECTIONS[normalize(section)] = section;
    });

    function applyDefaults($modal) {

        const modalBody = $modal.find('.modal-body')[0];

        if (!modalBody) return;

        // ----------------------------------
        // 1. Find section headings
        // ----------------------------------

        const headings = [];

        modalBody.querySelectorAll('*').forEach(el => {

            const text = normalize(el.innerText);

            if (!NORMALIZED_SECTIONS[text]) return;

            // Avoid selecting parent elements when
            // an exact matching child already exists.
            const matchingChild = [...el.children].some(child =>
                normalize(child.innerText) === text
            );

            if (!matchingChild) {
                headings.push({
                    element: el,
                    section: NORMALIZED_SECTIONS[text]
                });
            }
        });

        // ----------------------------------
        // 2. Process all checkboxes
        // ----------------------------------

        const inputs = modalBody.querySelectorAll(
            'input[type="checkbox"]'
        );

        inputs.forEach(input => {

            // Find the nearest checkbox row
            const row = input.closest('.checkbox') ||
                        input.closest('.form-check') ||
                        input.parentElement;

            if (!row) return;

            const labelElement = row.querySelector('label');

            if (!labelElement) return;

            const label = normalize(labelElement.innerText);

            // ----------------------------------
            // 3. Identify checkbox section
            // ----------------------------------

            let currentSection = null;

            headings.forEach(heading => {

                const position =
                    heading.element.compareDocumentPosition(input);

                // Heading must appear before checkbox
                if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
                    currentSection = heading.section;
                }

            });

            if (!currentSection) return;

            // ----------------------------------
            // 4. Check only allowed fields
            // ----------------------------------

            const allowedFields =
                SECTION_FIELDS[currentSection] || [];

            const allowed = allowedFields.some(field =>
                normalize(field) === label
            );

            if (input.checked !== allowed) {

                input.checked = allowed;

                // Notify Frappe
                input.dispatchEvent(
                    new Event('change', { bubbles: true })
                );

                console.log(
                    currentSection,
                    label,
                    allowed ? 'CHECKED' : 'UNCHECKED'
                );
            }

        });
    }

    // ----------------------------------
    // 5. Export Data modal
    // ----------------------------------

    $(document)
        .off('shown.bs.modal.export_defaults')
        .on(
            'shown.bs.modal.export_defaults',
            '.modal',
            function () {

                const $modal = $(this);

                if (
                    $modal.find('.modal-title').text().trim()
                    !== 'Export Data'
                ) {
                    return;
                }

                console.log('Export Data modal opened');

                applyDefaults($modal);

                // Watch for dynamically loaded fields
                const modalBody =
                    $modal.find('.modal-body')[0];

                if (!modalBody) return;

                const observer = new MutationObserver(() => {
                    applyDefaults($modal);
                });

                observer.observe(modalBody, {
                    childList: true,
                    subtree: true
                });

                $modal.one('hidden.bs.modal', function () {
                    observer.disconnect();
                });

            }
        );

}

};