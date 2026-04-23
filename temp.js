
      // API Configuration and State Management
      const API_BASE_URL = '/api'; // Change this to your actual API base URL
      let currentPage = 1;
      let currentFilters = {
        status: 'all',
        paymentStatus: '',
        paymentMethod: '',
        dateFrom: '',
        dateTo: '',
        fulfillmentType: '',
        pickupFilter: '',
        pickupDateFrom: '',
        pickupDateTo: ''
      };
      let currentSearch = '';
      let currentSort = {
        field: 'orderDate',
        direction: 'desc'
      };
      let searchTimeout = null;
      let selectedOrders = new Set();
      let allOrders = [];

      // Order Status Manager
      class OrderStatusManager {
        static async updateStatus(orderId, newStatus, selectElement) {
          try {
            // Store original value for potential rollback
            const originalStatus = selectElement.dataset.originalValue;

            // Update UI to saving state
            selectElement.classList.add('updating');
            selectElement.disabled = true;

            // Make API call
            const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                status: newStatus
              })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
              throw new Error(data.error?.message || 'Failed to update order status');
            }

            // Update UI to success state
            selectElement.dataset.originalValue = newStatus;
            selectElement.className = `status-select status-${newStatus.toLowerCase()}`;

            // Show success toast
            ToastManager.show(`Order status updated to ${newStatus}`, 'success');

            // Update the status badge in the row
            this.updateStatusBadge(orderId, newStatus);

            return data;

          } catch (error) {
            console.error('Status Update Error:', error);

            // Rollback to original value
            selectElement.value = selectElement.dataset.originalValue;

            // Show error toast
            ToastManager.show(error.message || 'Failed to update order status', 'error');

            throw error;
          } finally {
            // Remove updating state
            selectElement.classList.remove('updating');
            selectElement.disabled = false;
          }
        }

        static updateStatusBadge(orderId, newStatus) {
          const statusBadge = document.querySelector(`[data-order-id="${orderId}"] .status-badge`);
          if (statusBadge) {
            statusBadge.className = `status-badge px-2 py-1 text-xs font-medium rounded-full status-${newStatus.toLowerCase()}`;
            statusBadge.textContent = newStatus;
          }
        }

        static setupStatusSelect(selectElement, orderId) {
          // Store original value
          selectElement.dataset.originalValue = selectElement.value;

          // Change event
          selectElement.addEventListener('change', (e) => {
            const newStatus = e.target.value;
            if (newStatus !== selectElement.dataset.originalValue) {
              this.updateStatus(orderId, newStatus, selectElement);
            }
          });
        }
      }

      // Toast Notification Manager
      class ToastManager {
        static show(message, type = 'success', duration = 3000) {
          const toast = document.createElement('div');
          toast.className = `toast ${type}`;
          toast.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'} mr-2"></i>
              <span>${message}</span>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;

          document.getElementById('toastContainer').appendChild(toast);

          // Show toast
          setTimeout(() => toast.classList.add('show'), 100);

          // Auto-hide toast
          setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
              if (toast.parentElement) {
                toast.remove();
              }
            }, 300);
          }, duration);
        }
      }

      // Export Manager
      class ExportManager {
        static async exportOrders(orderIds, options = {}) {
          try {
            const exportModal = document.getElementById('exportProgress');
            const progressFill = document.getElementById('exportProgressFill');
            const statusText = document.getElementById('exportStatus');
            const detailsText = document.getElementById('exportDetails');

            // Show export modal
            exportModal.classList.add('show');
            statusText.textContent = 'Preparing export...';
            detailsText.textContent = `Exporting ${orderIds.length} orders`;
            progressFill.style.width = '10%';

            // Simulate progress steps
            await this.updateProgress(20, 'Gathering order data...', progressFill, statusText);
            await this.updateProgress(40, 'Processing order items...', progressFill, statusText);
            await this.updateProgress(60, 'Formatting Excel file...', progressFill, statusText);

            // Make API call
            const response = await fetch(`${API_BASE_URL}/orders/export`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                orderIds: orderIds,
                format: 'excel',
                includeItems: true,
                includeCustomer: true,
                includeAddress: true,
                ...options
              })
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
              throw new Error(data.error?.message || 'Export failed');
            }

            await this.updateProgress(80, 'Finalizing export...', progressFill, statusText);
            await this.updateProgress(100, 'Download ready!', progressFill, statusText);

            // Hide modal
            setTimeout(() => {
              exportModal.classList.remove('show');
            }, 1000);

            // Trigger download
            if (data.data.downloadUrl) {
              const link = document.createElement('a');
              link.href = data.data.downloadUrl;
              link.download = data.data.fileName || 'orders-export.xlsx';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }

            ToastManager.show(`Successfully exported ${data.data.recordCount} orders`, 'success');

            return data;

          } catch (error) {
            console.error('Export Error:', error);
            document.getElementById('exportProgress').classList.remove('show');
            ToastManager.show('Failed to export orders: ' + error.message, 'error');
            throw error;
          }
        }

        static async updateProgress(percent, status, progressElement, statusElement) {
          return new Promise(resolve => {
            setTimeout(() => {
              progressElement.style.width = `${percent}%`;
              statusElement.textContent = status;
              resolve();
            }, 500);
          });
        }
      }

      // Bulk Operations Manager
      class BulkOperationsManager {
        static updateSelectedCount() {
          const count = selectedOrders.size;
          const bulkBar = document.getElementById('bulkActionsBar');
          const selectedCountText = document.getElementById('selectedCount');
          const bulkExportBtn = document.getElementById('bulkExportBtn');

          selectedCountText.textContent = `${count} order${count !== 1 ? 's' : ''} selected`;
          bulkExportBtn.disabled = count === 0;

          if (count > 0) {
            bulkBar.classList.add('show');
          } else {
            bulkBar.classList.remove('show');
          }
        }

        static toggleOrderSelection(orderId, checkbox) {
          if (checkbox.checked) {
            selectedOrders.add(orderId);
          } else {
            selectedOrders.delete(orderId);
          }

          // Update order row styling
          const orderRow = checkbox.closest('tr') || checkbox.closest('.order-card');
          if (orderRow) {
            orderRow.classList.toggle('selected', checkbox.checked);
          }

          this.updateSelectedCount();
          this.updateSelectAllState();
        }

        static selectAllOrders(selectAll = true) {
          const checkboxes = document.querySelectorAll('.order-checkbox');
          checkboxes.forEach(checkbox => {
            checkbox.checked = selectAll;
            const orderId = checkbox.dataset.orderId;
            if (selectAll) {
              selectedOrders.add(orderId);
            } else {
              selectedOrders.delete(orderId);
            }

            // Update row styling
            const orderRow = checkbox.closest('tr') || checkbox.closest('.order-card');
            if (orderRow) {
              orderRow.classList.toggle('selected', selectAll);
            }
          });

          this.updateSelectedCount();
          this.updateSelectAllState();
        }

        static updateSelectAllState() {
          const selectAllCheckbox = document.getElementById('selectAllOrders');
          const checkboxes = document.querySelectorAll('.order-checkbox');
          const checkedCount = document.querySelectorAll('.order-checkbox:checked').length;

          if (checkedCount === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
          } else if (checkedCount === checkboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
          } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
          }
        }

        static async bulkUpdateStatus(status) {
          if (selectedOrders.size === 0) {
            ToastManager.show('Please select orders to update', 'warning');
            return;
          }

          // Special handling for cancellation: Show warning modal
          if (status === 'Cancelled') {
            const modal = document.getElementById('bulkCancelModal');
            const countText = document.getElementById('cancelCountText');
            const confirmBtn = document.getElementById('confirmBulkCancelBtn');

            countText.textContent = selectedOrders.size;
            modal.classList.add('show');

            // Setup confirmation button with one-time listener
            confirmBtn.onclick = async () => {
              modal.classList.remove('show');
              await BulkOperationsManager._executeBulkUpdate(status);
            };
            return;
          }

          // Direct update for other statuses
          await BulkOperationsManager._executeBulkUpdate(status);
        }

        static async _executeBulkUpdate(status) {
          try {
            const orderIds = Array.from(selectedOrders);

            const response = await fetch(`${API_BASE_URL}/orders/bulk-update`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                orderIds: orderIds,
                updates: {
                  status: status
                }
              })
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
              throw new Error(data.error?.message || 'Bulk update failed');
            }

            // The backend returns a detailed message about skipped orders
            ToastManager.show(data.message || `Updated orders to ${status}`, 'success');

            // Clear selection
            BulkOperationsManager.selectAllOrders(false);

            // Reload orders
            loadOrders();

          } catch (error) {
            console.error('Bulk Update Error:', error);
            ToastManager.show('Failed to update orders: ' + error.message, 'error');
          }
        }
      }

      // API Functions
      class OrdersAPI {
        static async fetchOrders(params = {}) {
          try {
            const queryParams = new URLSearchParams({
              page: params.page || currentPage,
              limit: params.limit || 10,
              search: params.search || currentSearch,
              status: currentFilters.status !== 'all' ? currentFilters.status : '',
              paymentStatus: currentFilters.paymentStatus || '',
              paymentMethod: currentFilters.paymentMethod || '',
              dateFrom: currentFilters.dateFrom || '',
              dateTo: currentFilters.dateTo || '',
              fulfillmentType: currentFilters.fulfillmentType || '',
              pickupFilter: currentFilters.pickupFilter || '',
              pickupDateFrom: currentFilters.pickupDateFrom || '',
              pickupDateTo: currentFilters.pickupDateTo || '',
              sortField: params.sortField || currentSort.field,
              sortDirection: params.sortDirection || currentSort.direction
            });

            // Remove empty parameters
            for (let [key, value] of queryParams.entries()) {
              if (!value || value === 'null') {
                queryParams.delete(key);
              }
            }

            const response = await fetch(`${API_BASE_URL}/orders?${queryParams}`);

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.message || `Server error (${response.status})`);
            }

            const data = await response.json();

            if (!data.success) {
              throw new Error(data.message || 'The server returned an unsuccessful response.');
            }

            return data;
          } catch (error) {
            console.error('API Error:', error);
            // Translate generic errors to user-friendly ones
            if (error.message.includes('Failed to fetch')) {
              throw new Error('Connection failed. Please check your internet or server status.');
            }
            throw error;
          }
        }

        static async getOrderDetails(orderId) {
          try {
            const response = await fetch(`${API_BASE_URL}/orders/${orderId}`);

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
          } catch (error) {
            console.error('Get Order Details Error:', error);
            throw error;
          }
        }

        static async refundOrder(orderId) {
          try {
            const response = await fetch(`${API_BASE_URL}/orders/${orderId}/refund`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              }
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
          } catch (error) {
            console.error('Refund API Error:', error);
            throw error;
          }
        }
      }

      // UI State Management
      class UIManager {
        static showLoading() {
          document.getElementById('loadingState').classList.remove('hidden');
          document.getElementById('ordersContainer').classList.add('hidden');
          document.getElementById('errorState').classList.add('hidden');
          document.getElementById('emptyState').classList.add('hidden');
        }

        static showError(message = 'Something went wrong') {
          document.getElementById('errorMessage').textContent = message;
          document.getElementById('errorState').classList.remove('hidden');
          document.getElementById('loadingState').classList.add('hidden');
          document.getElementById('ordersContainer').classList.add('hidden');
          document.getElementById('emptyState').classList.add('hidden');
        }

        static showEmpty() {
          document.getElementById('emptyState').classList.remove('hidden');
          document.getElementById('loadingState').classList.add('hidden');
          document.getElementById('ordersContainer').classList.add('hidden');
          document.getElementById('errorState').classList.add('hidden');
        }

        static showOrders() {
          document.getElementById('ordersContainer').classList.remove('hidden');
          document.getElementById('loadingState').classList.add('hidden');
          document.getElementById('errorState').classList.add('hidden');
          document.getElementById('emptyState').classList.add('hidden');
        }

        static updateFilterButtons(activeFilter, filterType) {
          document.querySelectorAll(`.filter-btn[data-type="${filterType}"]`).forEach(btn => {
            btn.classList.remove('filter-active');
            if (btn.dataset.filter === activeFilter) {
              btn.classList.add('filter-active');
            }
          });
        }
      }

      // Refund Manager
      class RefundManager {
        static currentOrderId = null;

        static showRefundModal(orderId, orderDisplayId) {
          this.currentOrderId = orderId;
          const modal = document.getElementById('refundConfirmModal');
          document.getElementById('refundOrderIdText').textContent = orderDisplayId;
          modal.classList.add('show');

          // One-time listeners
          const cancelBtn = document.getElementById('cancelRefundBtn');
          const confirmBtn = document.getElementById('confirmRefundBtn');

          cancelBtn.onclick = () => {
            modal.classList.remove('show');
            this.currentOrderId = null;
          };

          confirmBtn.onclick = async () => {
            await this.processRefund();
          };
        }

        static async processRefund() {
          if (!this.currentOrderId) return;

          const modal = document.getElementById('refundConfirmModal');
          const confirmBtn = document.getElementById('confirmRefundBtn');
          const originalBtnText = confirmBtn.innerHTML;

          try {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';

            const result = await OrdersAPI.refundOrder(this.currentOrderId);

            if (result.success) {
              ToastManager.show(result.message || 'Refund processed successfully', 'success');
              modal.classList.remove('show');
              loadOrders(); // Reload to show updated status
            } else {
              throw new Error(result.message || 'Refund failed');
            }
          } catch (error) {
            console.error('Refund Process Error:', error);
            ToastManager.show(error.message, 'error');
          } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalBtnText;
            this.currentOrderId = null;
          }
        }
      }

      // Template Rendering
      class TemplateRenderer {
        static renderStatsCards(stats) {
          const statsContainer = document.getElementById('statsCards');
          statsContainer.innerHTML = `
          <div class="bg-white p-4 rounded-lg shadow-sm border fade-in">
            <div class="flex items-center">
              <div class="bg-red-500 text-white p-3 rounded-lg">
                <i class="fas fa-exclamation-circle text-lg"></i>
              </div>
              <div class="ml-4">
                <p class="text-xs text-gray-500 font-bold uppercase tracking-wider">Cancel Pending</p>
                <p class="text-xl font-bold text-red-600">${stats.cancelPendingOrders || 0}</p>
              </div>
            </div>
          </div>

          <div class="bg-white p-4 rounded-lg shadow-sm border fade-in">
            <div class="flex items-center">
              <div class="bg-orange-500 text-white p-3 rounded-lg">
                <i class="fas fa-clock"></i>
              </div>
              <div class="ml-4">
                <p class="text-xs text-gray-500 font-bold uppercase tracking-wider">Delayed Pickups</p>
                <p class="text-xl font-bold text-orange-600">${stats.delayedPickups || 0}</p>
              </div>
            </div>
          </div>

          <div class="bg-white p-4 rounded-lg shadow-sm border fade-in">
            <div class="flex items-center">
              <div class="brand-teal text-white p-3 rounded-lg">
                <i class="fas fa-shopping-cart"></i>
              </div>
              <div class="ml-4">
                <p class="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Orders</p>
                <p class="text-xl font-bold">${stats.totalOrders || 0}</p>
              </div>
            </div>
          </div>

          <div class="bg-white p-4 rounded-lg shadow-sm border fade-in">
            <div class="flex items-center">
              <div class="bg-purple-500 text-white p-3 rounded-lg">
                <i class="fas fa-calendar-day"></i>
              </div>
              <div class="ml-4">
                <p class="text-sm text-gray-600">Today's Orders</p>
                <p class="text-xl font-bold">${stats.todayOrders || 0}</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white p-4 rounded-lg shadow-sm border fade-in">
            <div class="flex items-center">
              <div class="bg-blue-500 text-white p-3 rounded-lg">
                <i class="fas fa-clock"></i>
              </div>
              <div class="ml-4">
                <p class="text-sm text-gray-600">Pending</p>
                <p class="text-xl font-bold">${stats.pendingOrders || 0}</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white p-4 rounded-lg shadow-sm border fade-in">
            <div class="flex items-center">
              <div class="bg-green-500 text-white p-3 rounded-lg">
                <i class="fas fa-check-double"></i>
              </div>
              <div class="ml-4">
                <p class="text-sm text-gray-600">Delivered</p>
                <p class="text-xl font-bold">${stats.deliveredOrders || 0}</p>
              </div>
            </div>
          </div>
          
          <div class="bg-white p-4 rounded-lg shadow-sm border fade-in">
            <div class="flex items-center">
              <div class="brand-orange text-white p-3 rounded-lg">
                <i class="fas fa-wallet"></i>
              </div>
              <div class="ml-4">
                <p class="text-sm text-gray-600">Total Revenue</p>
                <p class="text-xl font-bold">AED ${(stats.totalRevenue || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        `;
        }

        static getRemainingTimeDisplay(estimatedPickupTime) {
          if (!estimatedPickupTime) return '';

          const now = new Date();
          const pickup = new Date(estimatedPickupTime);
          const diffMs = pickup - now;
          const isDelayed = diffMs < 0;
          const absDiffMs = Math.abs(diffMs);

          // Calculate units
          const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
          const hours = Math.floor((absDiffMs / (1000 * 60 * 60)) % 24);
          const mins = Math.floor((absDiffMs / (1000 * 60)) % 60);

          let timeStr = '';
          if (days > 0) timeStr += `${days}d `;
          if (hours > 0) timeStr += `${hours}h `;
          if (mins > 0 || (days === 0 && hours === 0)) timeStr += `${mins}min`;

          const result = `(${timeStr.trim()}${isDelayed ? ' delayed' : ''})`;
          
          if (isDelayed) {
            return `<span class="text-red-500 font-bold">${result}</span>`;
          } else {
            return `<span class="text-orange-500 font-bold">${result}</span>`;
          }
        }

        static renderDesktopTable(orders) {
          const tbody = document.getElementById('ordersTableBody');
          tbody.innerHTML = '';

          orders.forEach(order => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50 transition-colors fade-in';
            row.dataset.orderId = order._id;

            const orderItems = order.orderItems || [];
            const itemsPreview = orderItems.slice(0, 2).map(item => `${item.name.en || 'Unknown'} (${item.qty})`).join(', ');
            const remainingItems = orderItems.length > 2 ? ` +${orderItems.length - 2} more` : '';
            const isaDeliveryAssigned = order.deliveryExecutive && order.deliveryExecutive.assigned ? true : false;
            const deliveryBoyIdQuery = isaDeliveryAssigned ? `deliveryExecutive='${order.deliveryExecutive.id}'` : '';
            row.innerHTML = `
            <td class="p-4">
              <input type="checkbox" class="order-checkbox rounded border-gray-300 text-brand-teal focus:ring-brand-teal" 
                     data-order-id="${order._id}">
            </td>
            <td class="p-4">
              <div>
                <div class="font-semibold text-gray-900">${order.orderId}</div>
                <div class="text-sm text-gray-600">Store: ${order.storeId}</div>
              </div>
            </td>
            <td class="p-4">
              <div class="flex flex-col gap-1">
                <span class="px-2 py-0.5 text-[10px] font-bold rounded-full w-fit ${order.fulfillmentType === 'Pickup' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                  ${order.fulfillmentType || 'Delivery'}
                </span>
                ${order.fulfillmentType === 'Pickup' && order.estimatedPickupTime && order.status !== 'Delivered' && order.status !== 'Cancelled' ? `
                  <div class="flex flex-col">
                    <span class="text-[10px] font-bold text-teal-600">
                      <i class="fas fa-clock mr-1"></i>${new Date(order.estimatedPickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span class="text-[9px] pickup-timer" data-time="${order.estimatedPickupTime}">
                      ${TemplateRenderer.getRemainingTimeDisplay(order.estimatedPickupTime)}
                    </span>
                  </div>
                ` : order.fulfillmentType === 'Pickup' && order.status !== 'Delivered' && order.status !== 'Cancelled' ? `<span class="text-[10px] font-medium text-gray-500">ASAP</span>` : ''}
              </div>
            </td>
            <td class="p-4">
              <div>
                <div class="font-medium text-gray-900">${order.address.fullName || 'N/A'}</div>
                <div class="text-sm text-gray-600">${order.address.phone || 'No phone'}</div>
                ${order.address && order.fulfillmentType !== 'Pickup' ? `<div class="address-tooltip text-xs text-blue-600 cursor-help">
                  <i class="fas fa-map-marker-alt mr-1"></i>View Address
                  <div class="tooltip-content">
                    ${order.address.fullName || ''}<br>
                    ${order.address.building || ''}, ${order.address.flat || ''}<br>
                    ${order.address.street || ''}, ${order.address.area || ''}<br>
                    ${order.address.city || ''}
                  </div>
                </div>` : ''}
              </div>
            </td>
            <td class="p-4">
              <div class="order-items-preview">
                <div class="text-sm font-medium text-gray-900">${itemsPreview}${remainingItems}</div>
                <div class="text-xs text-gray-500">${orderItems.length} item${orderItems.length !== 1 ? 's' : ''}</div>
              </div>
            </td>
            <td class="p-4">
              <div class="font-semibold text-gray-900">AED ${order.totalAmount.toFixed(2)}</div>
              ${order.discount > 0 ? `<div class="text-xs text-green-600">-AED ${order.discount.toFixed(2)} discount</div>` : ''}
            </td>
            <td class="p-4">
              <div class="space-y-1">
                <span class="px-2 py-1 text-xs font-medium rounded-full payment-${order.paymentStatus.toLowerCase()}">
                  ${order.paymentStatus}
                </span>
                <div class="text-xs text-gray-600">${order.paymentMethod}</div>
              </div>
            </td>
            <td class="p-4">
              <select class="status-select status-${order.status.toLowerCase()}" data-order-id="${order._id}" data-original-value="${order.status}">
                <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Placed" ${order.status === 'Placed' ? 'selected' : ''}>Placed</option>
                <option value="Confirmed" ${order.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
                <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                ${order.paymentMethod !== 'Online' ? `<option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>` : ''}
                <option value="Cancel_Pending" ${order.status === 'Cancel_Pending' ? 'selected' : ''}>Cancel Pending</option>
              </select>
            </td>
            <td class="p-4">
              <div class="text-sm text-gray-900">${new Date(order.orderDate).toLocaleDateString()}</div>
              <div class="text-xs text-gray-600">${new Date(order.orderDate).toLocaleTimeString()}</div>
            </td>

            
          `;
            // <td class="p-4">
            //   <div class="flex space-x-2">
            //     <button class="text-blue-600 hover:text-blue-800 p-1" title="View Details" onclick="viewOrderDetails('${order._id}')">
            //       <i class="fas fa-eye"></i>
            //     </button>
            //     <button class="text-green-600 hover:text-green-800 p-1" title="Print Invoice" onclick="printInvoice('${order._id}')">
            //       <i class="fas fa-print"></i>
            //     </button>
            //   </div>
            // </td>
            tbody.appendChild(row);

            if (order.status === 'Cancel_Pending' || order.cancelReason) {
              const reasonRow = document.createElement('tr');
              reasonRow.className = 'bg-red-50 border-b fade-in';
              reasonRow.innerHTML = `
                <td colspan="8" class="p-4">
                  <div class="flex items-start justify-between w-full">
                    <div class="flex items-start">
                      <div class="bg-red-100 text-red-600 p-2 rounded-lg mr-4">
                        <i class="fas fa-exclamation-circle text-lg"></i>
                      </div>
                      <div>
                        <div class="font-bold text-red-800 uppercase text-xs tracking-wider mb-1">
                          Cancellation Request ${order.cancelDate ? `(${new Date(order.cancelDate).toLocaleString()})` : ''}
                        </div>
                        <p class="text-sm text-red-700 italic font-medium">"${order.cancelReason || 'No reason provided'}"</p>
                      </div>
                    </div>
                    ${order.paymentMethod === 'Online' ? `
                    <button onclick="RefundManager.showRefundModal('${order._id}', '${order.orderId}')" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all transform hover:scale-105">
                      <i class="fas fa-undo-alt mr-2"></i>Cancel & Refund
                    </button>` : ''}
                  </div>
                </td>
              `;
              tbody.appendChild(reasonRow);
            }
          });

          // Setup order checkbox listeners
          document.querySelectorAll('.order-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
              BulkOperationsManager.toggleOrderSelection(e.target.dataset.orderId, e.target);
            });
          });

          // Setup status select listeners
          document.querySelectorAll('.status-select').forEach(select => {
            const orderId = select.dataset.orderId;
            OrderStatusManager.setupStatusSelect(select, orderId);
          });
        }

        static renderMobileCards(orders) {
          const container = document.getElementById('ordersMobileView');
          container.innerHTML = '';

          orders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-card p-4 border-b fade-in';
            card.dataset.orderId = order._id;

            const orderItems = order.orderItems || [];
            const itemsPreview = orderItems.slice(0, 3).map(item =>
              `<span class="order-item-badge">${item.name.en || 'Unknown'} (${item.qty})</span>`
            ).join('');
            const remainingItems = orderItems.length > 3 ? `<span class="order-item-badge">+${orderItems.length - 3} more</span>` : '';

            card.innerHTML = `
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center">
                <input type="checkbox" class="order-checkbox mr-3 rounded border-gray-300 text-brand-teal focus:ring-brand-teal" 
                       data-order-id="${order._id}">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold text-gray-900">${order.orderId}</h3>
                    <span class="px-1.5 py-0.5 text-[9px] font-bold rounded-full ${order.fulfillmentType === 'Pickup' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                      ${order.fulfillmentType || 'Delivery'}
                    </span>
                  </div>
                  <p class="text-sm text-gray-500">${order.userId?.name || 'Unknown Customer'}</p>
                  ${order.fulfillmentType === 'Pickup' && order.estimatedPickupTime && order.status !== 'Delivered' && order.status !== 'Cancelled' ? `
                    <div class="flex items-center gap-2">
                        <p class="text-[10px] font-bold text-teal-600">
                        <i class="fas fa-clock mr-1"></i>${new Date(order.estimatedPickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p class="text-[9px] pickup-timer" data-time="${order.estimatedPickupTime}">
                        ${TemplateRenderer.getRemainingTimeDisplay(order.estimatedPickupTime)}
                        </p>
                    </div>
                  ` : order.fulfillmentType === 'Pickup' && order.status !== 'Delivered' && order.status !== 'Cancelled' ? `<p class="text-[10px] font-medium text-gray-500">ASAP</p>` : ''}
                </div>
              </div>
              <div class="flex flex-col items-end space-y-1">
                <span class="status-badge px-2 py-1 text-xs font-medium rounded-full status-${order.status.toLowerCase()}">
                  ${order.status}
                </span>
                <span class="px-2 py-1 text-xs font-medium rounded-full payment-${order.paymentStatus.toLowerCase()}">
                  ${order.paymentStatus}
                </span>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p class="text-xs text-gray-500 mb-1">Total Amount</p>
                <p class="font-semibold">AED ${order.totalAmount.toFixed(2)}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-1">Payment Method</p>
                <p class="text-sm">${order.paymentMethod}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-1">Order Date</p>
                <p class="text-sm">${new Date(order.orderDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-1">Items (${orderItems.length})</p>
                <div class="order-items-preview">
                  ${itemsPreview}${remainingItems}
                </div>
              </div>
            </div>

            <div class="mb-3">
              <p class="text-xs text-gray-500 mb-2">Update Status</p>
              <select class="status-select status-${order.status.toLowerCase()} w-full" data-order-id="${order._id}" data-original-value="${order.status}">
                <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Placed" ${order.status === 'Placed' ? 'selected' : ''}>Placed</option>
                <option value="Confirmed" ${order.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>Processing</option>
                <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                ${order.paymentMethod !== 'Online' ? `<option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>` : ''}
                <option value="Cancel_Pending" ${order.status === 'Cancel_Pending' ? 'selected' : ''}>Cancel Pending</option>
              </select>
            </div>
          `;

            if (order.status === 'Cancel_Pending' || order.cancelReason) {
              const reasonDiv = document.createElement('div');
              reasonDiv.className = 'mt-3 p-3 bg-red-50 rounded-lg border border-red-100';
              reasonDiv.innerHTML = `
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center">
                    <i class="fas fa-exclamation-circle text-red-500 mr-2 text-xs"></i>
                    <span class="text-[10px] font-bold text-red-800 uppercase tracking-tight">Cancellation Request</span>
                  </div>
                  ${order.paymentMethod === 'Online' ? `
                  <button onclick="RefundManager.showRefundModal('${order._id}', '${order.orderId}')" class="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold shadow-sm transition-transform active:scale-95">
                    Refund
                  </button>` : ''}
                </div>
                <p class="text-xs text-red-700 italic font-medium">"${order.cancelReason || 'No reason provided'}"</p>
              `;
              card.appendChild(reasonDiv);
            }

            container.appendChild(card);
          });

          // Setup mobile checkbox listeners
          document.querySelectorAll('.order-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
              BulkOperationsManager.toggleOrderSelection(e.target.dataset.orderId, e.target);
            });
          });

          // Setup mobile status select listeners
          document.querySelectorAll('.status-select').forEach(select => {
            const orderId = select.dataset.orderId;
            OrderStatusManager.setupStatusSelect(select, orderId);
          });
        }

        static renderPagination(pagination) {
          const infoContainer = document.getElementById('paginationInfo');
          const buttonsContainer = document.getElementById('paginationButtons');

          // Update pagination info
          const start = (pagination.currentPage - 1) * 10 + 1;
          const end = Math.min(pagination.currentPage * 10, pagination.totalOrders);
          infoContainer.innerHTML = `
          Showing <span class="font-medium">${start}</span> to <span class="font-medium">${end}</span> 
          of <span class="font-medium">${pagination.totalOrders}</span> orders
        `;

          // Update pagination buttons
          buttonsContainer.innerHTML = '';

          // Previous button
          const prevBtn = document.createElement('button');
          prevBtn.className = `px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ${!pagination.hasPrev ? 'disabled:opacity-50 disabled:cursor-not-allowed' : ''}`;
          prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
          prevBtn.disabled = !pagination.hasPrev;
          prevBtn.onclick = () => pagination.hasPrev && changePage(pagination.currentPage - 1);
          buttonsContainer.appendChild(prevBtn);

          // Page numbers
          const startPage = Math.max(1, pagination.currentPage - 2);
          const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);

          for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `px-3 py-2 text-sm rounded-lg transition-colors ${i === pagination.currentPage ? 'bg-teal-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => changePage(i);
            buttonsContainer.appendChild(pageBtn);
          }

          // Next button
          const nextBtn = document.createElement('button');
          nextBtn.className = `px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors ${!pagination.hasNext ? 'disabled:opacity-50 disabled:cursor-not-allowed' : ''}`;
          nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
          nextBtn.disabled = !pagination.hasNext;
          nextBtn.onclick = () => pagination.hasNext && changePage(pagination.currentPage + 1);
          buttonsContainer.appendChild(nextBtn);
        }

        static renderChart(chartData) {
          const ctx = document.getElementById('revenueChart').getContext('2d');

          new Chart(ctx, {
            type: 'line',
            data: {
              labels: chartData.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              datasets: [{
                label: 'Orders',
                data: chartData.orders || [12, 19, 15, 25, 22, 30, 28],
                borderColor: '#1E7065',
                backgroundColor: 'rgba(30, 112, 101, 0.1)',
                yAxisID: 'y'
              }, {
                label: 'Revenue (AED)',
                data: chartData.revenue || [1200, 1900, 1500, 2500, 2200, 3000, 2800],
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                yAxisID: 'y1'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                mode: 'index',
                intersect: false,
              },
              scales: {
                x: {
                  display: true,
                  title: {
                    display: true,
                    text: 'Day'
                  }
                },
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  title: {
                    display: true,
                    text: 'Orders'
                  }
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  title: {
                    display: true,
                    text: 'Revenue (AED)'
                  },
                  grid: {
                    drawOnChartArea: false,
                  },
                }
              },
              plugins: {
                legend: {
                  position: 'top',
                },
                title: {
                  display: false
                }
              }
            }
          });
        }
      }

      // Date Range Manager
      class DateRangeManager {
        static setupDateRangePicker() {
          const dateRangeBtn = document.getElementById('dateRangeBtn');
          const dateRangeDropdown = document.getElementById('dateRangeDropdown');
          const dateRangeText = document.getElementById('dateRangeText');

          // Toggle dropdown
          dateRangeBtn.addEventListener('click', () => {
            dateRangeDropdown.classList.toggle('show');
          });

          // Close dropdown when clicking outside
          document.addEventListener('click', (e) => {
            if (!dateRangeBtn.contains(e.target) && !dateRangeDropdown.contains(e.target)) {
              dateRangeDropdown.classList.remove('show');
            }
          });

          // Preset buttons
          document.querySelectorAll('.date-preset').forEach(btn => {
            btn.addEventListener('click', () => {
              const preset = btn.dataset.preset;
              this.applyDatePreset(preset);
              dateRangeText.textContent = btn.textContent;
              dateRangeDropdown.classList.remove('show');
            });
          });

          // Apply custom date range
          document.getElementById('applyDateRange').addEventListener('click', () => {
            const dateFrom = document.getElementById('dateFrom').value;
            const dateTo = document.getElementById('dateTo').value;

            if (dateFrom && dateTo) {
              currentFilters.dateFrom = dateFrom;
              currentFilters.dateTo = dateTo;
              dateRangeText.textContent = `${new Date(dateFrom).toLocaleDateString()} - ${new Date(dateTo).toLocaleDateString()}`;
              loadOrders();
            }

            dateRangeDropdown.classList.remove('show');
          });

          // Clear date range
          document.getElementById('clearDateRange').addEventListener('click', () => {
            currentFilters.dateFrom = '';
            currentFilters.dateTo = '';
            document.getElementById('dateFrom').value = '';
            document.getElementById('dateTo').value = '';
            dateRangeText.textContent = 'All Time';
            dateRangeDropdown.classList.remove('show');
            loadOrders();
          });
        }

        static applyDatePreset(preset) {
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);

          switch (preset) {
            case 'today':
              currentFilters.dateFrom = today.toISOString().split('T')[0];
              currentFilters.dateTo = today.toISOString().split('T')[0];
              break;
            case 'yesterday':
              currentFilters.dateFrom = yesterday.toISOString().split('T')[0];
              currentFilters.dateTo = yesterday.toISOString().split('T')[0];
              break;
            case 'last7days':
              const last7Days = new Date(today);
              last7Days.setDate(last7Days.getDate() - 7);
              currentFilters.dateFrom = last7Days.toISOString().split('T')[0];
              currentFilters.dateTo = today.toISOString().split('T')[0];
              break;
            case 'last30days':
              const last30Days = new Date(today);
              last30Days.setDate(last30Days.getDate() - 30);
              currentFilters.dateFrom = last30Days.toISOString().split('T')[0];
              currentFilters.dateTo = today.toISOString().split('T')[0];
              break;
            case 'thismonth':
              const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
              currentFilters.dateFrom = firstDay.toISOString().split('T')[0];
              currentFilters.dateTo = today.toISOString().split('T')[0];
              break;
          }

          loadOrders();
        }
      }

      // Main Functions
      async function loadOrders() {
        UIManager.showLoading();

        try {
          // Clear selections when loading new data
          selectedOrders.clear();
          BulkOperationsManager.updateSelectedCount();

          const response = await OrdersAPI.fetchOrders();
          // For demo purposes, you can also use: const response = await simulateAPICall();

          if (response.data.orders.length === 0) {
            UIManager.showEmpty();
            return;
          }

          allOrders = response.data.orders;

          UIManager.showOrders();
          TemplateRenderer.renderStatsCards(response.data.stats);
          TemplateRenderer.renderDesktopTable(response.data.orders);
          TemplateRenderer.renderMobileCards(response.data.orders);
          TemplateRenderer.renderPagination(response.data.pagination);

          // Render chart if data is available
          if (response.data.chartData) {
            TemplateRenderer.renderChart(response.data.chartData);
          }

        } catch (error) {
          console.error('Load Orders Error:', error);
          const errorMsg = document.getElementById('errorMessage');
          if (errorMsg) errorMsg.textContent = error.message || 'Failed to load orders. Please try again.';
          UIManager.showError();
        }
      }

      // Mock API simulation for demo (replace with actual API calls)
      async function simulateAPICall() {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const mockOrders = generateMockOrders();
        const filteredOrders = filterMockOrders(mockOrders);

        return {
          success: true,
          data: {
            orders: filteredOrders.slice((currentPage - 1) * 10, currentPage * 10),
            pagination: {
              currentPage: currentPage,
              totalPages: Math.ceil(filteredOrders.length / 10),
              totalOrders: filteredOrders.length,
              limit: 10,
              hasNext: currentPage < Math.ceil(filteredOrders.length / 10),
              hasPrev: currentPage > 1
            },
            stats: {
              totalOrders: mockOrders.length,
              pendingOrders: mockOrders.filter(o => o.status === 'Pending').length,
              confirmedOrders: mockOrders.filter(o => o.status === 'Confirmed').length,
              processingOrders: mockOrders.filter(o => o.status === 'Processing').length,
              deliveredOrders: mockOrders.filter(o => o.status === 'Delivered').length,
              cancelledOrders: mockOrders.filter(o => o.status === 'Cancelled').length,
              totalRevenue: mockOrders.reduce((sum, order) => sum + order.totalAmount, 0),
              todayOrders: mockOrders.filter(o => {
                const today = new Date().toDateString();
                return new Date(o.orderDate).toDateString() === today;
              }).length,
              unpaidOrders: mockOrders.filter(o => o.paymentStatus === 'Unpaid').length
            },
            chartData: {
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              orders: [12, 19, 15, 25, 22, 30, 28],
              revenue: [1200, 1900, 1500, 2500, 2200, 3000, 2800]
            }
          }
        };
      }

      function generateMockOrders() {
        const statuses = ['Pending', 'Placed', 'Confirmed', 'Processing', 'Delivered', 'Cancelled'];
        const paymentStatuses = ['Paid', 'Unpaid', 'Failed'];
        const paymentMethods = ['Cash', 'Online'];

        const orders = [];

        for (let i = 1; i <= 50; i++) {
          const orderDate = new Date();
          orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30));

          const order = {
            _id: `order_${i}`,
            orderId: `ORD-2023-${String(i).padStart(4, '0')}`,
            storeId: `STORE-${Math.floor(Math.random() * 3) + 1}`,
            userId: {
              _id: `user_${i}`,
              name: `Customer ${i}`,
              email: `customer${i}@example.com`,
              phone: `+971501234${String(i).padStart(3, '0')}`
            },
            orderDate: orderDate.toISOString(),
            status: statuses[Math.floor(Math.random() * statuses.length)],
            paymentStatus: paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
            paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
            subTotal: 50 + Math.random() * 200,
            charges: [
              { name: 'Delivery Fee', amount: 10 },
              { name: 'Service Fee', amount: 5 }
            ],
            discount: Math.random() > 0.7 ? Math.random() * 20 : 0,
            totalAmount: 0, // Will be calculated
            couponCode: Math.random() > 0.8 ? 'SAVE10' : null,
            orderItems: [
              {
                productId: 'prod1',
                name: 'Classic Espresso',
                image: 'https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=60',
                qty: Math.floor(Math.random() * 3) + 1,
                unitPrice: 18,
                total: 0
              },
              {
                productId: 'prod2',
                name: 'Chocolate Croissant',
                image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=60',
                qty: Math.floor(Math.random() * 2) + 1,
                unitPrice: 16.50,
                total: 0
              }
            ],
            address: {
              fullName: `Customer ${i}`,
              phone: `+971501234${String(i).padStart(3, '0')}`,
              building: `Building ${i}`,
              flat: `${Math.floor(Math.random() * 20) + 1}`,
              street: 'Sheikh Zayed Road',
              area: 'Downtown Dubai',
              city: 'Dubai',
              landmark: 'Near Dubai Mall',
              notes: 'Please call upon arrival'
            },
            assignedTo: Math.random() > 0.5 ? {
              _id: 'delivery1',
              name: 'Mohammed Ali',
              phone: '+971507654321'
            } : null,
            updatedAt: orderDate.toISOString()
          };

          // Calculate totals
          order.orderItems.forEach(item => {
            item.total = item.qty * item.unitPrice;
          });

          const itemsTotal = order.orderItems.reduce((sum, item) => sum + item.total, 0);
          const chargesTotal = order.charges.reduce((sum, charge) => sum + charge.amount, 0);
          order.subTotal = itemsTotal;
          order.totalAmount = itemsTotal + chargesTotal - order.discount;

          orders.push(order);
        }

        return orders;
      }

      function filterMockOrders(orders) {
        let filtered = [...orders];

        // Apply search filter
        if (currentSearch) {
          filtered = filtered.filter(order =>
            order.orderId.toLowerCase().includes(currentSearch.toLowerCase()) ||
            order.userId?.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
            order.userId?.phone.includes(currentSearch)
          );
        }

        // Apply status filter
        if (currentFilters.status !== 'all') {
          filtered = filtered.filter(order => order.status === currentFilters.status);
        }

        // Apply payment status filter
        if (currentFilters.paymentStatus) {
          filtered = filtered.filter(order => order.paymentStatus === currentFilters.paymentStatus);
        }

        // Apply payment method filter
        if (currentFilters.paymentMethod) {
          filtered = filtered.filter(order => order.paymentMethod === currentFilters.paymentMethod);
        }

        // Apply date range filter
        if (currentFilters.dateFrom && currentFilters.dateTo) {
          const fromDate = new Date(currentFilters.dateFrom);
          const toDate = new Date(currentFilters.dateTo);
          toDate.setHours(23, 59, 59, 999); // Include the entire end date

          filtered = filtered.filter(order => {
            const orderDate = new Date(order.orderDate);
            return orderDate >= fromDate && orderDate <= toDate;
          });
        }

        // Apply sorting
        if (currentSort.field) {
          filtered.sort((a, b) => {
            let aVal, bVal;

            if (currentSort.field === 'orderDate') {
              aVal = new Date(a.orderDate);
              bVal = new Date(b.orderDate);
            } else if (currentSort.field === 'totalAmount') {
              aVal = a.totalAmount;
              bVal = b.totalAmount;
            } else {
              aVal = a[currentSort.field];
              bVal = b[currentSort.field];
            }

            const modifier = currentSort.direction === 'asc' ? 1 : -1;
            return aVal > bVal ? modifier : aVal < bVal ? -modifier : 0;
          });
        }

        return filtered;
      }

      // Event Handlers
      function handleSearch(value) {
        currentSearch = value;
        currentPage = 1;
        loadOrders();

        const clearBtn = document.getElementById('clearSearch');
        if (value) {
          clearBtn.classList.remove('hidden');
        } else {
          clearBtn.classList.add('hidden');
        }
      }

      function handleFilter(filter, filterType) {
        currentPage = 1;

        if (filterType === 'status') {
          currentFilters.status = filter;
          UIManager.updateFilterButtons(filter, 'status');
        } else if (filterType === 'paymentStatus') {
          currentFilters.paymentStatus = filter;
          UIManager.updateFilterButtons(filter, 'paymentStatus');
        } else if (filterType === 'paymentMethod') {
          currentFilters.paymentMethod = filter;
          UIManager.updateFilterButtons(filter, 'paymentMethod');
        } else if (filterType === 'fulfillment') {
          currentFilters.fulfillmentType = filter;
          currentFilters.pickupFilter = ''; // Reset pulse when main type changes
          
          UIManager.updateFilterButtons(filter, 'fulfillment');
          // Reset child filter button UI
          document.querySelectorAll('.filter-btn[data-type="pickupStatus"]').forEach(b => b.classList.remove('filter-active'));

          const pickupSubFilters = document.getElementById('pickupSubFilters');
          const pickupDivider = document.getElementById('pickupDivider');
          const pickupDate = document.getElementById('pickupDateContainer');

          if (filter === 'Pickup') {
            if (pickupSubFilters) pickupSubFilters.classList.remove('hidden');
            if (pickupDivider) pickupDivider.classList.remove('hidden');
            if (pickupDate) pickupDate.classList.remove('hidden');
          } else {
            if (pickupSubFilters) pickupSubFilters.classList.add('hidden');
            if (pickupDivider) pickupDivider.classList.add('hidden');
            if (pickupDate) pickupDate.classList.add('hidden');
          }
        } else if (filterType === 'pickupStatus') {
          // Toggle logic for pickup pulse filters
          if (currentFilters.pickupFilter === filter) {
            currentFilters.pickupFilter = '';
            UIManager.updateFilterButtons('', 'pickupStatus');
          } else {
            currentFilters.pickupFilter = filter;
            UIManager.updateFilterButtons(filter, 'pickupStatus');
          }
        }

        updateFilterSummary();
        loadOrders();
      }

      function updateFilterSummary() {
          const summaryEl = document.getElementById('filterSummary');
          const activeFilters = [];
          
          if (currentFilters.status !== 'all') activeFilters.push(`Status: ${currentFilters.status}`);
          if (currentFilters.fulfillmentType) activeFilters.push(`Type: ${currentFilters.fulfillmentType}`);
          if (currentFilters.pickupFilter) activeFilters.push(`Pulse: ${currentFilters.pickupFilter}`);
          if (currentFilters.paymentStatus) activeFilters.push(`Payment: ${currentFilters.paymentStatus}`);
          if (currentFilters.paymentMethod) activeFilters.push(`Method: ${currentFilters.paymentMethod}`);
          
          if (activeFilters.length > 0) {
              summaryEl.innerHTML = `<i class="fas fa-filter mr-1"></i> Filtering by: <span class="text-gray-700 font-bold">${activeFilters.join(', ')}</span>`;
              summaryEl.classList.remove('hidden');
          } else {
              summaryEl.classList.add('hidden');
          }
      }

      function changePage(page) {
        currentPage = page;
        loadOrders();
      }

      function handleSort(field) {
        if (currentSort.field === field) {
          currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          currentSort.field = field;
          currentSort.direction = 'asc';
        }
        loadOrders();
      }

      function viewOrderDetails(orderId) {
        // Navigate to order details page or open modal
        window.location.href = `/orders/view/${orderId}`;
      }

      function printInvoice(orderId) {
        // Open print dialog or generate PDF
        window.open(`/orders/${orderId}/invoice`, '_blank');
      }

      function clearFilters() {
        currentPage = 1;
        currentSearch = '';
        currentFilters = {
          status: 'all',
          paymentStatus: '',
          paymentMethod: '',
          dateFrom: '',
          dateTo: '',
          fulfillmentType: '',
          pickupFilter: '',
          pickupDateFrom: '',
          pickupDateTo: ''
        };

        // Reset UI Components Safety
        const si = document.getElementById('searchInput');
        if (si) si.value = '';
        const cs = document.getElementById('clearSearch');
        if (cs) cs.classList.add('hidden');

        // Reset Order Date UI
        const drt = document.getElementById('dateRangeText');
        if (drt) drt.textContent = 'Order Date';
        const df = document.getElementById('dateFrom');
        if (df) df.value = '';
        const dt = document.getElementById('dateTo');
        if (dt) dt.value = '';
        
        // Reset Pickup UI
        const pdrt = document.getElementById('pickupDateRangeText');
        if (pdrt) pdrt.textContent = 'Pickup Date';
        const pdf = document.getElementById('pickupDateFrom');
        if (pdf) pdf.value = '';
        const pdt = document.getElementById('pickupDateTo');
        if (pdt) pdt.value = '';
        
        const psf = document.getElementById('pickupSubFilters');
        const pdc = document.getElementById('pickupDateContainer');
        const pd = document.getElementById('pickupDivider');
        
        if (psf) psf.classList.add('hidden');
        if (pdc) pdc.classList.add('hidden');
        if (pd) pd.classList.add('hidden');

        // Reset all buttons visual state
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('filter-active'));
        
        // Highlights
        document.querySelectorAll('.filter-btn[data-filter="all"][data-type="status"]').forEach(b => b.classList.add('filter-active'));
        document.querySelectorAll('.filter-btn[data-filter=""][data-type="fulfillment"]').forEach(b => b.classList.add('filter-active'));
        document.querySelectorAll('.filter-btn[data-filter=""][data-type="paymentStatus"]').forEach(b => b.classList.add('filter-active'));
        document.querySelectorAll('.filter-btn[data-filter=""][data-type="paymentMethod"]').forEach(b => b.classList.add('filter-active'));

        updateFilterSummary();
        loadOrders();
      }

      // Initialize page
      document.addEventListener('DOMContentLoaded', function () {
        // Load initial data
        updateFilterSummary();
        loadOrders();

        // Setup date range picker
        DateRangeManager.setupDateRangePicker();

        // Setup persistent listeners
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.addEventListener('input', function (e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => handleSearch(e.target.value), 300);
          });
        }

        const clearSearchBtn = document.getElementById('clearSearch');
        if (clearSearchBtn) {
          clearSearchBtn.addEventListener('click', function () {
            searchInput.value = '';
            handleSearch('');
          });
        }

        // Centralized Filter Button Click Listener (Handles Toggling)
        document.querySelectorAll('.filter-btn').forEach(btn => {
          btn.addEventListener('click', function () {
            const filter = this.dataset.filter;
            const filterType = this.dataset.type;

            // Toggle Behavior: If clicking the active button (and it wasn't already the default 'All')
            if (this.classList.contains('filter-active') && filter !== 'all' && filter !== '') {
               // Revert to default
               if (filterType === 'status') handleFilter('all', 'status');
               else handleFilter('', filterType);
            } else {
               handleFilter(filter, filterType);
            }
          });
        });

        // Pickup Date Range Dropdown Toggle
        const pickupDateRangeBtn = document.getElementById('pickupDateRangeBtn');
        const pickupDateRangeDropdown = document.getElementById('pickupDateRangeDropdown');

        if (pickupDateRangeBtn) {
          pickupDateRangeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            pickupDateRangeDropdown.classList.toggle('show');
            document.getElementById('dateRangeDropdown').classList.remove('show');
          });
        }

        // Apply Pickup Date Range
        const applyPickupBtn = document.getElementById('applyPickupDateRange');
        if (applyPickupBtn) {
          applyPickupBtn.addEventListener('click', () => {
            const fromDate = document.getElementById('pickupDateFrom').value;
            const toDate = document.getElementById('pickupDateTo').value;

            if (fromDate || toDate) {
              currentFilters.pickupDateFrom = fromDate ? new Date(fromDate).toISOString() : '';
              currentFilters.pickupDateTo = toDate ? new Date(toDate).toISOString() : '';
              document.getElementById('pickupDateRangeText').textContent = 'Custom Range';
              pickupDateRangeDropdown.classList.remove('show');
              currentPage = 1;
              loadOrders();
            }
          });
        }

        // Pickup Date Presets
        document.querySelectorAll('.pickup-date-preset').forEach(preset => {
          preset.addEventListener('click', function() {
            const type = this.dataset.preset;
            const now = new Date();
            let fromDate, toDate;

            if (type === 'today') {
              fromDate = new Date(now.setHours(0,0,0,0));
              toDate = new Date(now.setHours(23,59,59,999));
              document.getElementById('pickupDateRangeText').textContent = 'Today\'s Pickups';
            } else if (type === 'tomorrow') {
              const tomorrow = new Date(now.setDate(now.getDate() + 1));
              fromDate = new Date(tomorrow.setHours(0,0,0,0));
              toDate = new Date(tomorrow.setHours(23,59,59,999));
              document.getElementById('pickupDateRangeText').textContent = 'Tomorrow\'s Pickups';
            }

            currentFilters.pickupDateFrom = fromDate.toISOString();
            currentFilters.pickupDateTo = toDate.toISOString();
            
            document.getElementById('pickupDateFrom').value = fromDate.toISOString().split('T')[0];
            document.getElementById('pickupDateTo').value = toDate.toISOString().split('T')[0];
            
            pickupDateRangeDropdown.classList.remove('show');
            currentPage = 1;
            loadOrders();
          });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
          if (!e.target.closest('.date-range-picker')) {
            document.getElementById('dateRangeDropdown').classList.remove('show');
            if (pickupDateRangeDropdown) pickupDateRangeDropdown.classList.remove('show');
          }
        });

        // Sort buttons
        document.getElementById('sortByAmount').addEventListener('click', () => handleSort('totalAmount'));
        document.getElementById('sortByDate').addEventListener('click', () => handleSort('orderDate'));

        // Update pickup timers every 30 seconds
        setInterval(() => {
          document.querySelectorAll('.pickup-timer').forEach(el => {
            const time = el.dataset.time;
            if (time) {
              el.innerHTML = TemplateRenderer.getRemainingTimeDisplay(time);
            }
          });
        }, 30000);

        // Bulk operations
        document.getElementById('selectAllOrders').addEventListener('change', function () {
          BulkOperationsManager.selectAllOrders(this.checked);
        });

        document.getElementById('selectAllBtn').addEventListener('click', () => {
          BulkOperationsManager.selectAllOrders(true);
        });

        document.getElementById('clearSelectionBtn').addEventListener('click', () => {
          BulkOperationsManager.selectAllOrders(false);
        });

        document.getElementById('bulkUpdateBtn').addEventListener('click', () => {
          const status = document.getElementById('bulkStatusUpdate').value;
          if (status) {
            BulkOperationsManager.bulkUpdateStatus(status);
            document.getElementById('bulkStatusUpdate').value = '';
          }
        });

        // Export buttons
        document.getElementById('bulkExportBtn').addEventListener('click', () => {
          if (selectedOrders.size > 0) {
            ExportManager.exportOrders(Array.from(selectedOrders));
          }
        });

        document.getElementById('bulkExportSelectedBtn').addEventListener('click', () => {
          if (selectedOrders.size > 0) {
            ExportManager.exportOrders(Array.from(selectedOrders));
          }
        });

        // Other buttons
        document.getElementById('retryBtn').addEventListener('click', loadOrders);
        document.getElementById('clearFiltersBtn').addEventListener('click', clearFilters);
        const cfeBtn = document.getElementById('clearFiltersBtnEmpty');
        if (cfeBtn) cfeBtn.addEventListener('click', clearFilters);
      });

      // Global functions
      window.viewOrderDetails = viewOrderDetails;
      window.printInvoice = printInvoice;
    