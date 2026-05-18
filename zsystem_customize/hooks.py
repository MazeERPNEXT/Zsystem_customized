app_name = "zsystem_customize"
app_title = "Zsystem Customize"
app_publisher = "mazeworks solutions pvt ltd"
app_description = "zsystem customize"
app_email = "sales@mazeworkssolutions.com"
app_license = "mit"
# required_apps = []

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/zsystem_customize/css/zsystem_customize.css"
app_include_js = ["zsystem_customize.bundle.js"]

# include js, css files in header of web template
# web_include_css = "/assets/zsystem_customize/css/zsystem_customize.css"
# web_include_js = "/assets/zsystem_customize/js/zsystem_customize.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "zsystem_customize/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {
    "Purchase Receipt": "public/js/purchase_receipt.js",
    "Delivery Note": "public/js/delivery_note.js",
    # "Sales Order":"public/js/sales_order.js"
}

# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "zsystem_customize/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "zsystem_customize.utils.jinja_methods",
# 	"filters": "zsystem_customize.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "zsystem_customize.install.before_install"
# after_install = "zsystem_customize.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "zsystem_customize.uninstall.before_uninstall"
# after_uninstall = "zsystem_customize.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "zsystem_customize.utils.before_app_install"
# after_app_install = "zsystem_customize.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "zsystem_customize.utils.before_app_uninstall"
# after_app_uninstall = "zsystem_customize.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "zsystem_customize.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

override_doctype_class = {
	# "ToDo": "custom_app.overrides.CustomToDo"
    "Subcontracting Receipt": "zsystem_customize.update_stock_in_item_doctype.CustomSubcontractingReceipt",
    "Stock Reconciliation": "zsystem_customize.update_stock_in_item_doctype.CustomStockReconciliation",
    "Stock Entry": "zsystem_customize.update_stock_in_item_doctype.CustomStockEntry",
    "Purchase Receipt": "zsystem_customize.update_stock_in_item_doctype.CustomPurchaseReceipt",
    "Delivery Note": "zsystem_customize.update_stock_in_item_doctype.CustomDeliveryNote",
    "Asset Capitalization": "zsystem_customize.update_stock_in_item_doctype.CustomAssetCapitalization",
    "Sales Invoice": "zsystem_customize.update_stock_in_item_doctype.CustomSalesInvoice",
    "Purchase Invoice": "zsystem_customize.update_stock_in_item_doctype.CustomPurchaseInvoice",

    # "Sales Order": "armtech.armtech.overrides_class.sales_order.CustomSalesOrder",
    # "Purchase Order": "zsystem_customize.update_stock_in_item_doctype.CustomPurchaseOrder",
}

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
#     "Sales Order": {
#         "before_submit": "zsystem_customize.sales_order.validate_so_stock"
#     }
	# "*": {
	# 	"on_update": "method",
	# 	"on_cancel": "method",
	# 	"on_trash": "method"
	# }
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"zsystem_customize.tasks.all"
# 	],
# 	"daily": [
# 		"zsystem_customize.tasks.daily"
# 	],
# 	"hourly": [
# 		"zsystem_customize.tasks.hourly"
# 	],
# 	"weekly": [
# 		"zsystem_customize.tasks.weekly"
# 	],
# 	"monthly": [
# 		"zsystem_customize.tasks.monthly"
# 	],
# scheduler_events = {
#     "cron": {
#         "09 14 * * *": [
#             "zsystem_customize.send_remainder.send_stock_remainder"
#         ]
#     }
# }


# Testing
# -------

# before_tests = "zsystem_customize.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "zsystem_customize.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "zsystem_customize.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["zsystem_customize.utils.before_request"]
# after_request = ["zsystem_customize.utils.after_request"]

# Job Events
# ----------
# before_job = ["zsystem_customize.utils.before_job"]
# after_job = ["zsystem_customize.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"zsystem_customize.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

