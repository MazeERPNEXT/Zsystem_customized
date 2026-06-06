// frappe.listview_settings['Customer'] = {
//     onload(listview) {
//         setTimeout(() => {
//             $('.primary-action')
//                 .html('<svg class="icon icon-xs"><use href="#icon-add"></use></svg> Add New Customer')
//                 .attr('data-label', 'Add New Customer');
//         }, 500);
//     }
// };
frappe.listview_settings['Customer'] = {
    refresh(listview) {
        setTimeout(() => {
            const btn = $('.primary-action');

            if (btn.length) {
                btn.attr('data-label', 'Add New Customer');
                btn.find('.hidden-xs').text('Add New Customer');
            }
        }, 300);
    }
};