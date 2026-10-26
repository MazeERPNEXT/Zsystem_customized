frappe.listview_settings['Purchase Receipt'] = {
    add_fields: ['status'],

    get_indicator: function (doc) {
        if (doc.status === 'Return Issued') {
            return [__('Return Issued'), 'grey', 'status,=,Return Issued'];
        }
        if (doc.status === 'Return') {
            return [__('Return'), 'grey', 'status,=,Return'];
        }

        if (doc.status === 'Completed') {
            return [__('Completed'), 'green', 'status,=,Completed'];
        }
        if (doc.status === 'To Bill') {
            return [__('To Bill'), 'orange', 'status,=,To Bill'];
        }
    }
};