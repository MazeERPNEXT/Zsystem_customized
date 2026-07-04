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
};