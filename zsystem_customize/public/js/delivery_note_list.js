frappe.listview_settings['Delivery Note'] = {
    add_fields: ["custom_returnable_dc", "is_return", "status","per_billed"],

    get_indicator(doc) {

        // Return DC
        if (
            doc.docstatus === 1 &&
            doc.custom_returnable_dc == 1 &&
            doc.is_return == 1
        ) {
            return [__("Return DC"), "red", "custom_returnable_dc,=,1"];
        }
        if (
            doc.docstatus === 1 &&
            doc.custom_returnable_dc == 1 && doc.per_billed >= 100
        ) {
            return [__("Completed"), "green", "custom_returnable_dc,=,1"];
        }

        // Returnable DC
        if (
            doc.docstatus === 1 &&
            doc.custom_returnable_dc == 1
        ) {
            return [__("Returnable DC"), "orange", "custom_returnable_dc,=,1"];
        }
        
        
        // Default indicators
        if (doc.docstatus === 0) {
            return [__("Draft"), "red", "docstatus,=,0"];
        }

        if (doc.docstatus === 1) {

            if (doc.status === "Completed") {
                return [__("Completed"), "green", "status,=,Completed"];
            }

            if (doc.status === "Return Issued") {
                return [__("Return Issued"), "grey", "status,=,Return Issued"];
            }
             if (doc.status === "Return") {
                return [__("Return"), "grey", "status,=,Return"];
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
    }
};