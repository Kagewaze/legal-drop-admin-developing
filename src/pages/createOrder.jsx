import { useGlobalContext } from "../utils/context";
import customFetch from "../utils/customFetch";
import { toast } from "react-toastify";
import { SenderForm } from "../components/orders/senderForm";
import { ReceiverForm } from "../components/orders/receiverForm";

export const CreateOrder = () => {
  const {
    setGlobalLoading,
    senderForm,
    setSenderForm,
    defaultFormData,
    senderlongitude,
    senderlatitude,
    receiversForm,
    setReceiversForm,
  } = useGlobalContext();

  // submit
  async function handleSubmit(e) {
    e.preventDefault();

    // check if address for sender and receiver are
    if (!senderForm.senderAddress) {
      return toast.error("Sender address is required");
    }
    if (receiversForm.every((receiver) => !receiver.receiverAddress)) {
      return toast.error("Receiver address is required");
    }

    setGlobalLoading(true);
    const url = "order";

    try {
      const updatedReceivers = receiversForm.map((receiver) => {
        // Filter out empty values from each receiver
        const filteredReceiver = Object.fromEntries(
          Object.entries(receiver).filter(
            ([_, value]) =>
              value !== undefined && value !== null && value !== ""
          )
        );

        // Return the updated receiver with parsed distance and default location
        return {
          ...filteredReceiver,
          distance: parseInt(filteredReceiver.distance),
          categories: [filteredReceiver.categories],
        };
      });

      const filteredSenderForm = Object.fromEntries(
        Object.entries(senderForm).filter(
          ([_, value]) => value !== undefined && value !== null && value !== ""
        )
      );

      const { status } = await customFetch.post(url, {
        ...filteredSenderForm,
        senderLocation: {
          latitude: senderlatitude ?? 0,
          longitude: senderlongitude ?? 0,
        },
        receivers: updatedReceivers,
      });

      if (status === 201) {
        setGlobalLoading(false);
        // reset form
        setSenderForm({
          ...defaultFormData.sender,
        });
        setReceiversForm([defaultFormData.receiver]);
        toast.success("Order created successfully");
      }
    } catch (error) {
      setGlobalLoading(false);
      toast.error("Error occurred while creating order");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-3 md:px-8 max-w-2xl ">
      <SenderForm />
      {/* receiver */}
      <ReceiverForm />
      {/* submit */}
      <button
        type="submit"
        className="mt-12 w-[40%] bg-primaryGreen text-white py-2 rounded-lg"
      >
        Create Order
      </button>
    </form>
  );
};
