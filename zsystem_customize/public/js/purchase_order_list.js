frappe.listview_settings['Purchase Order'] = {
    add_fields: ["status","per_received","per_billed"],

    get_indicator(doc) {
        if (doc.docstatus === 1 &&
            doc.per_billed == 100
        ) {
            return [__("Completed"), "green"];
        }
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
                'ID',
                'Supplier',
                'Date',
                'Status',
                'Mode of Dispatch',
                'Courier Name',
                'Zsystem Responsible Person',
                'Grand Total',
                'Rounded Total (Company Currency)'
            ],

            'Items (Purchase Order Item) (1 row mandatory)': [
                'Item Code',
                'Description',
                'Item Group',
                'UOM',
                'Quantity',
                'Rate',
                'Amount',
                'Brand'
            ],

            'Purchase Order Pricing Rule (Pricing Rule Detail)': []
        };

        const normalize = (str) =>
            (str || '')
                .replace(/\*/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();

        const sections = {};

        Object.keys(SECTION_FIELDS).forEach(section => {
            sections[normalize(section)] = section;
        });

        function applyExportDefaults($modal) {

            const $body = $modal.find('.modal-body');

            let currentSection = null;

            $body.find('*').each(function () {

                const $el = $(this);

                // --------------------------------
                // 1. Detect Section Heading
                // --------------------------------

                if (!$el.find('input[type="checkbox"]').length) {

                    const directText = $el.clone()
                        .children()
                        .remove()
                        .end()
                        .text();

                    const matched = sections[normalize(directText)];

                    if (matched) {
                        currentSection = matched;
                    }
                }

                // --------------------------------
                // 2. Detect Checkbox
                // --------------------------------

                $el.find('input[type="checkbox"]').addBack('input[type="checkbox"]')
                    .each(function () {

                        const checkbox = this;

                        let label = '';

                        // Associated label
                        if (checkbox.id) {
                            label = $body.find(
                                'label[for="' + checkbox.id + '"]'
                            ).first().text();
                        }

                        // Parent label fallback
                        if (!label) {
                            label = $(checkbox).closest('label').text();
                        }

                        // Checkbox row fallback
                        if (!label) {
                            label = $(checkbox)
                                .closest('.checkbox, .form-check')
                                .text();
                        }

                        const fieldName = normalize(label);

                        if (!currentSection) return;

                        const allowedFields = SECTION_FIELDS[currentSection];

                        const shouldCheck = allowedFields.some(field =>
                            normalize(field) === fieldName
                        );

                        const isChecked = checkbox.checked;

                        // Keep mandatory disabled fields unchanged
                        if (checkbox.disabled) return;

                        // Check allowed fields
                        // Uncheck all other fields
                        if (isChecked !== shouldCheck) {

                            checkbox.checked = shouldCheck;

                            $(checkbox).trigger('change');
                        }

                    });

            });
        }

        // --------------------------------
        // 3. Export Data Modal
        // --------------------------------

        $(document)
            .off('shown.bs.modal.purchase_order_export')
            .on(
                'shown.bs.modal.purchase_order_export',
                '.modal',
                function () {

                    const $modal = $(this);

                    if (
                        normalize($modal.find('.modal-title').text())
                        !== 'export data'
                    ) {
                        return;
                    }

                    console.log('Purchase Order Export: Applying defaults');

                    setTimeout(() => {
                        applyExportDefaults($modal);
                    }, 300);

                    const modalBody = $modal.find('.modal-body')[0];

                    if (!modalBody) return;

                    const observer = new MutationObserver(() => {
                        applyExportDefaults($modal);
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

        // --------------------------------
        // 4. Hide Supplier Name Filter
        // --------------------------------

        setTimeout(() => {

            listview.page.wrapper
                .find('[data-fieldname="supplier_name"]')
                .closest('.form-group')
                .hide();

        }, 500);

    }
};