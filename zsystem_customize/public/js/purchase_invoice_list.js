frappe.listview_settings['Purchase Invoice'] = {
    onload(listview) {
        setTimeout(() => {
            listview.page.wrapper
                .find('.standard-filter-section [data-fieldname="supplier_name"]')
                .closest('.form-group')
                .hide();
        }, 500);
    },

    get_indicator(doc) {
        if (doc.status === "Overdue") {
            return [__("Overdue"), "red", "status,=,Overdue"];
        } else if (doc.status === "Unpaid") {
            return [__("Unpaid"), "orange", "status,=,Unpaid"];
        } else if (doc.status === "Paid") {
            return [__("Paid"), "green", "status,=,Paid"];
        } else if (doc.status === "Draft") {
            return [__("Draft"), "grey", "status,=,Draft"];
        } else if (doc.status === "Cancelled") {
            return [__("Cancelled"), "red", "status,=,Cancelled"];
        } else if (doc.status === "Return") {
            return [__("Return"), "grey", "status,=,Return"];
        } else if (doc.status === "Partly Paid") {
            return [__("Partly Paid"), "yellow", "status,=,Partly Paid"];
        } else if (doc.status === "Debit Note Issued") {
            return [__("Debit Note Issued"), "grey", "status,=,Debit Note Issued"];
        } else {
            return [__(doc.status), "blue", "status,=," + doc.status];
        }
    }
};