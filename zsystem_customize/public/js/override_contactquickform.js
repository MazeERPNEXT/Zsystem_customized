// frappe.provide("frappe.ui.form");

// class ZsystemContactAddressQuickEntryForm
//     extends frappe.ui.form.ContactAddressQuickEntryForm {

//     render_dialog() {
//         super.render_dialog();

//         this.mandatory = this.mandatory || [];

//         ["email_address", "mobile_number"].forEach(field => {
//             if (!this.mandatory.includes(field)) {
//                 this.mandatory.push(field);
//             }

//             this.dialog.set_df_property(field, "reqd", 1);
//         });

//         this.dialog.refresh();
//     }

//     insert() {
//         // 🔒 HARD validation
//         if (!this.dialog.doc.email_address) {
//             frappe.msgprint(__("Email Address is mandatory"));
//             return;
//         }

//         if (!this.dialog.doc.mobile_number) {
//             frappe.msgprint(__("Mobile Number is mandatory"));
//             return;
//         }

//         // Map alias fields
//         const map_field_names = {
//             email_address: "email_id",
//             mobile_number: "mobile_no",
//         };

//         Object.entries(map_field_names).forEach(([from, to]) => {
//             this.dialog.doc[to] = this.dialog.doc[from];
//             delete this.dialog.doc[from];
//         });

//         return super.insert();
//     }

//     get_variant_fields() {
//         return [
//             {
//                 fieldtype: "Section Break",
//                 label: __("Primary Contact Detail"),
//             },
//             {
//                 label: __("Email Id"),
//                 fieldname: "email_address",
//                 fieldtype: "Data",
//                 options: "Email",
//                 reqd: 1,
//             },
//             {
//                 fieldtype: "Column Break",
//             },
//             {
//                 label: __("Mobile Number"),
//                 fieldname: "mobile_number",
//                 fieldtype: "Data",
//                 reqd: 1,
//             },
//             {
//                 fieldtype: "Section Break",
//                 label: __("Primary Address Details"),
//             },
//             {
//                 label: __("Address Line 1"),
//                 fieldname: "address_line1",
//                 fieldtype: "Data",
//             },
//             {
//                 label: __("Address Line 2"),
//                 fieldname: "address_line2",
//                 fieldtype: "Data",
//             },
//         ];
//     }
// }

// // ✅ Override AFTER frappe loads
//     frappe.ui.form.ContactAddressQuickEntryForm =ZsystemContactAddressQuickEntryForm;
