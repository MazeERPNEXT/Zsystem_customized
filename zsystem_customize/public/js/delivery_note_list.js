frappe.listview_settings['Delivery Note'] = {
    add_fields: [
        "custom_priority_order",
        "custom_returnable_dc",
        "is_return",
        "status",
        "per_billed"
    ],

    before_render() {
        if (cur_list && cur_list.data) {
            cur_list.data.sort((a, b) => {
                return (a.custom_priority_order || 999) -
                       (b.custom_priority_order || 999);
            });
        }
    },

    get_indicator(doc) {

        if (doc.docstatus === 0) {
            return [__("Draft"), "red", "docstatus,=,0"];
        }

        if (doc.docstatus === 2) {
            return [__("Cancelled"), "red", "docstatus,=,2"];
        }

        if (
            doc.docstatus === 1 &&
            doc.custom_returnable_dc == 1
        ) {

            if (doc.is_return == 1) {
                return [__("Return DC"), "red", "status,=,Return DC"];
            }

            if (doc.status === "Return Issued") {
                return [__("Return Issued"), "grey", "status,=,Return Issued"];
            }

            if (flt(doc.per_billed) >= 100) {
                return [__("Completed"), "green", "status,=,Completed"];
            }

            return [__("Outstanding Item"), "orange", "status,=,Outstanding Item"];
        }

        if (doc.docstatus === 1) {

            if (doc.status === "Completed") {
                return [__("Completed"), "green", "status,=,Completed"];
            }

            if (doc.status === "Return") {
                return [__("Return"), "grey", "status,=,Return"];
            }

            if (doc.status === "Return Issued") {
                return [__("Return Issued"), "grey", "status,=,Return Issued"];
            }

            if (doc.status === "To Bill") {
                return [__("To Bill"), "orange", "status,=,To Bill"];
            }
            if (doc.status === "Partially Billed") {
                return [__("Partially Billed"), "orange", "status,=,Partially Billed"];
            }


            if (doc.status === "Closed") {
                return [__("Closed"), "green", "status,=,Closed"];
            }

            return [__("Submitted"), "blue", "docstatus,=,1"];
        }
    },
    onload(listview) {
        apply_delivery_note_list_customization();
    },

    refresh(listview) {
        apply_delivery_note_list_customization();
    }
};
function apply_delivery_note_list_customization() {
    setTimeout(() => {

        // -----------------------------
        // Move Status header after ID
        // -----------------------------
        let $header = $(".list-row-head");

        let $statusHeader = null;
        let $idHeader = null;

        $header.find(".list-row-col").each(function () {
            let txt = $(this).text().trim();

            if (txt === "Status") {
                $statusHeader = $(this);
            }

            if (txt === "ID") {
                $idHeader = $(this);
            }
        });

        if ($statusHeader && $idHeader) {
            $statusHeader.insertAfter($idHeader);
        }

        // -----------------------------
        // Move Status value after ID
        // -----------------------------
        $(".list-row-container .list-row").each(function () {

            let $row = $(this);

            let $statusCol = null;
            let $idCol = null;

            $row.find(".list-row-col").each(function () {

                let $col = $(this);
                let text = $col.text().trim();

                // ID column
                if (
                    text.startsWith("ZSICDC") ||
                    text.startsWith("DN-")
                ) {
                    $idCol = $col;
                }

                // Status column only
                let $statusSpan = $col.find("[data-filter^='status,']");

                if ($statusSpan.length) {
                    $statusCol = $col;
                } else if (
                    text === "To Bill" ||
                    text === "Completed" ||
                    text === "To Deliver and Bill" ||
                    text === "To Bill and Deliver" ||
                    text === "Draft" ||
                    text === "Cancelled" ||
                    text === "Return Issued"
                ) {
                    $statusCol = $col;
                }

            });

            if ($statusCol && $idCol) {
                $statusCol.insertAfter($idCol);
            }

        });

    }, 500);
}