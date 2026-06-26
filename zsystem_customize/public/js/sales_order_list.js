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
    }
};