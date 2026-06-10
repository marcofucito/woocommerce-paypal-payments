import { useEffect, useState } from '@wordpress/element';

import {
	PayPalScriptProvider,
	PayPalCardFieldsProvider,
	PayPalNameField,
	PayPalNumberField,
	PayPalExpiryField,
	PayPalCVVField,
} from '@paypal/react-paypal-js';

import { CheckoutHandler } from './checkout-handler';
import {
	createOrder,
	onApprove,
	createVaultSetupToken,
	onApproveSavePayment,
} from '../card-fields-config';
import { cartHasSubscriptionProducts } from '../Helper/Subscription';
import { __ } from '@wordpress/i18n';

const CHECKOUT_SELECTOR =
	'.wp-block-woocommerce-checkout, .wc-block-checkout';
const INVALID_CHECKOUT_FIELD_SELECTOR = [
	'.wc-block-components-validation-error',
	'.wc-block-components-text-input.has-error',
	'.wc-block-components-combobox.has-error',
	'.wc-block-components-address-form__address_1.has-error',
	'[aria-invalid="true"]',
].join( ',' );
const REQUIRED_CHECKOUT_FIELD_SELECTOR =
	'input[required], input[aria-required="true"], select[required], select[aria-required="true"], textarea[required], textarea[aria-required="true"]';

function isVisible( element ) {
	if ( ! element ) {
		return false;
	}

	return Boolean(
		element.offsetWidth ||
			element.offsetHeight ||
			element.getClientRects().length
	);
}

function isRequiredFieldInvalid( field ) {
	if ( ! isVisible( field ) || field.disabled ) {
		return false;
	}

	if (
		field.getAttribute( 'aria-required' ) !== 'true' &&
		field.required !== true
	) {
		return false;
	}

	if ( typeof field.checkValidity === 'function' ) {
		return ! field.checkValidity();
	}

	if ( 'value' in field ) {
		return String( field.value ).trim() === '';
	}

	return false;
}

function hasInvalidRequiredCheckoutFields() {
	if ( typeof document === 'undefined' ) {
		return false;
	}

	const checkout = document.querySelector( CHECKOUT_SELECTOR );

	if ( ! checkout ) {
		return false;
	}

	const invalidFieldExists = Array.from(
		checkout.querySelectorAll( INVALID_CHECKOUT_FIELD_SELECTOR )
	).some( isVisible );

	if ( invalidFieldExists ) {
		return true;
	}

	return Array.from(
		checkout.querySelectorAll( REQUIRED_CHECKOUT_FIELD_SELECTOR )
	).some( isRequiredFieldInvalid );
}

export function CardFields( { config, eventRegistration, emitResponse } ) {
	const { onPaymentSetup } = eventRegistration;
	const { responseTypes } = emitResponse;

	const [ cardFieldsForm, setCardFieldsForm ] = useState();
	const getCardFieldsForm = ( cardFieldsForm ) => {
		setCardFieldsForm( cardFieldsForm );
	};

	const getSavePayment = ( savePayment ) => {
		localStorage.setItem( 'ppcp-save-card-payment', savePayment );
	};

	const hasSubscriptionProducts = cartHasSubscriptionProducts(
		config.scriptData
	);
	useEffect( () => {
		localStorage.removeItem( 'ppcp-save-card-payment' );

		if ( hasSubscriptionProducts ) {
			localStorage.setItem( 'ppcp-save-card-payment', 'true' );
		}
	}, [ hasSubscriptionProducts ] );

	useEffect(
		() =>
			onPaymentSetup( () => {
				async function handlePaymentProcessing() {
					if ( hasInvalidRequiredCheckoutFields() ) {
						return {
							type: responseTypes.ERROR,
							message: __(
								'Please complete all required checkout fields before continuing with payment.',
								'woocommerce-paypal-payments'
							),
						};
					}

					if (
						! cardFieldsForm ||
						typeof cardFieldsForm.submit !== 'function'
					) {
						return {
							type: responseTypes.ERROR,
							message: __(
								'Payment form is not ready. Please try again.',
								'woocommerce-paypal-payments'
							),
						};
					}

					try {
						await cardFieldsForm.submit();
					} catch ( error ) {
						console.error( error );
						return {
							type: responseTypes.ERROR,
							message:
								config.scriptData.hosted_fields.labels
									.fields_not_valid,
						};
					}

					return {
						type: responseTypes.SUCCESS,
					};
				}

				return handlePaymentProcessing();
			} ),
		[ onPaymentSetup, cardFieldsForm ]
	);

	return (
		<>
			<PayPalScriptProvider
				options={ {
					clientId: config.scriptData.client_id,
					components: 'card-fields',
					dataNamespace: 'ppcp-block-card-fields',
				} }
			>
				<PayPalCardFieldsProvider
					createVaultSetupToken={
						config.scriptData.is_free_trial_cart
							? createVaultSetupToken
							: undefined
					}
					createOrder={
						config.scriptData.is_free_trial_cart
							? undefined
							: createOrder
					}
					onApprove={
						config.scriptData.is_free_trial_cart
							? onApproveSavePayment
							: onApprove
					}
					onError={ ( err ) => {
						console.error( err );
					} }
				>
					{ config.name_on_card === 'yes' && (
						<PayPalNameField
							placeholder={ __(
								'Cardholder Name (optional)',
								'woocommerce-paypal-payments'
							) }
						/>
					) }
					<PayPalNumberField
						placeholder={ __(
							'Card number',
							'woocommerce-paypal-payments'
						) }
					/>
					<div style={ { display: 'flex', width: '100%' } }>
						<div style={ { width: '100%' } }>
							<PayPalExpiryField
								placeholder={ __(
									'MM / YY',
									'woocommerce-paypal-payments'
								) }
							/>
						</div>
						<div style={ { width: '100%' } }>
							<PayPalCVVField
								placeholder={ __(
									'CVV',
									'woocommerce-paypal-payments'
								) }
							/>
						</div>
					</div>
					<CheckoutHandler
						getCardFieldsForm={ getCardFieldsForm }
						getSavePayment={ getSavePayment }
						hasSubscriptionProducts={ hasSubscriptionProducts }
						saveCardText={ config.save_card_text }
						is_vaulting_enabled={ config.is_vaulting_enabled }
					/>
				</PayPalCardFieldsProvider>
			</PayPalScriptProvider>
		</>
	);
}
