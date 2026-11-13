import { useEffect, useMemo, useState } from 'react';
import { fetchMedicalContent, updateMedicalContent } from '../../api/medical-content';
import type { DisclaimerData, FirstAidTopic, MedicalCondition } from './medical-content.types';

export const STORAGE_KEY_DISCLAIMER = 'qrc_medical_disclaimer';
export const STORAGE_KEY_FIRST_AID = 'qrc_first_aid_topics';
export const STORAGE_KEY_CONDITIONS = 'qrc_medical_conditions';
export const STORAGE_KEY_USER_CONDITIONS = 'qrc_user_conditions';
export const EVENT_MEDICAL_CONTENT_CHANGED = 'qrc_medical_content_changed';

export const DEFAULT_DISCLAIMER_DATA: DisclaimerData = {
  title: 'Điều khoản miễn trừ trách nhiệm',
  warningText: 'Vui lòng đọc kỹ trước khi xem hướng dẫn sơ cứu:',
  items: [
    {
      id: 'reference',
      title: 'Tính chất tham khảo',
      content:
        'Các thông tin và chỉ dẫn sơ cứu tại đây chỉ mang tính chất tham khảo kiến thức cơ bản ban đầu trong trường hợp khẩn cấp và không thay thế cho việc khám, chẩn đoán hay điều trị chuyên khoa của bác sĩ hoặc nhân viên y tế.',
    },
    {
      id: 'priority-115',
      title: 'Ưu tiên cấp cứu 115',
      content:
        'Trong mọi trường hợp nguy kịch hoặc tai nạn giao thông nghiêm trọng, việc gọi ngay Cấp cứu 115 và đưa nạn nhân đến cơ sở y tế gần nhất luôn là ưu tiên quan trọng nhất.',
    },
    {
      id: 'waiver',
      title: 'Miễn trừ trách nhiệm',
      content:
        'QR Care, nhà phát triển và đơn vị vận hành không chịu bất kỳ trách nhiệm pháp lý hoặc bồi thường nào đối với các thương tật, biến chứng hoặc hậu quả phát sinh từ việc người dùng áp dụng các thao tác sơ cứu.',
    },
  ],
  checkboxLabel:
    'Tôi đã đọc, hiểu rõ và đồng ý với điều khoản miễn trừ trách nhiệm này trước khi xem hướng dẫn.',
  confirmButtonText: 'Đồng ý & Xem hướng dẫn',
  cancelButtonText: 'Hủy bỏ',
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_FIRST_AID_TOPICS: FirstAidTopic[] = [
  {
    id: 'drcab',
    title: '1. Quy trình đánh giá DRCAB',
    summary: 'Quy trình ưu tiên hàng đầu khi tiếp cận nạn nhân tai nạn',
    icon: 'Activity',
    priorityBadge: 'Quy tắc vàng',
    steps: [
      {
        title: 'D - Danger (Nguy hiểm)',
        detail:
          'Quan sát hiện trường, đảm bảo an toàn cho chính bạn và nạn nhân trước khi tiếp cận (tránh xe cộ, dây điện rơi, nguy cơ cháy nổ).',
      },
      {
        title: 'R - Response (Phản ứng)',
        detail:
          'Vỗ nhẹ hai vai và gọi to: "Anh/Chị có nghe thấy tôi không?". Nếu không phản ứng, lập tức gọi 115 và tìm người xung quanh hỗ trợ.',
      },
      {
        title: 'C - Circulation (Tuần hoàn & Ép tim CPR)',
        detail:
          'Nếu nạn nhân ngưng thở hoặc thở ngáp cá: Đặt hai bàn tay đan vào nhau ở giữa ngực, ép tim liên tục tần số 100 - 120 lần/phút.',
      },
      {
        title: 'A - Airway (Đường thở)',
        detail:
          'Ngửa đầu, nâng cằm nạn nhân để làm thông thoáng đường thở. Kiểm tra nếu có dị vật, đờm dãi trong miệng thì nhẹ nhàng móc ra.',
      },
      {
        title: 'B - Breathing (Hô hấp)',
        detail:
          'Kiểm tra xem ngực có phập phồng không trong 5 - 10 giây. Nếu không thở hoặc thở yếu, kết hợp thổi ngạt sau mỗi 30 lần ép tim.',
      },
    ],
    dos: [
      'Quan sát hiện trường trước khi chạm vào nạn nhân',
      'Nhờ người khác cùng hỗ trợ gọi 115 và giữ an toàn giao thông',
    ],
    donts: ['Không lao vào cứu khi hiện trường còn nguy hiểm (dây điện hở, xe đang cháy)'],
    order: 1,
  },
  {
    id: 'cpr',
    title: '2. Hồi sinh tim phổi (CPR) cho người lớn',
    summary: 'Áp dụng khi nạn nhân bất tỉnh, ngừng tim, ngừng thở',
    icon: 'HeartPulse',
    priorityBadge: 'Khẩn cấp',
    steps: [
      {
        title: 'Vị trí đặt tay',
        detail:
          'Gót một bàn tay đặt chính giữa ngực (nửa dưới xương ức), bàn tay kia đan lên trên, giữ khuỷu tay thẳng đứng vuông góc với ngực nạn nhân.',
      },
      {
        title: 'Kỹ thuật ép tim',
        detail:
          'Dùng trọng lượng thân trên ép xuống với độ sâu 5 - 6 cm, để ngực nở lại hoàn toàn sau mỗi lần ép mà không nhấc tay khỏi ngực.',
      },
      {
        title: 'Tần số ép tim',
        detail: "Duy trì tần số ép 100 - 120 lần/phút (theo nhịp bài hát Stayin' Alive).",
      },
      {
        title: 'Tỉ lệ Ép tim : Thổi ngạt',
        detail:
          'Nếu đã qua đào tạo: 30 lần ép tim xen kẽ 2 lần thổi ngạt. Nếu chưa qua đào tạo: Chỉ cần ép tim liên tục (Hands-only CPR) cho tới khi y tế đến.',
      },
    ],
    dos: ['Ép mạnh và nhanh, hạn chế tối đa thời gian gián đoạn ép tim'],
    donts: ['Không ép lên vùng xương sườn hai bên hoặc phần mũi ức'],
    warning: 'CPR càng sớm trong 4 phút đầu thì cơ hội sống sót của nạn nhân càng cao.',
    order: 2,
  },
  {
    id: 'spine',
    title: '3. Nghi ngờ chấn thương cột sống & cổ',
    summary: 'Đặc biệt chú ý với tai nạn xe máy, ngã từ trên cao',
    icon: 'Bone',
    priorityBadge: 'Cực kỳ nguy hiểm',
    steps: [
      {
        title: 'Giữ bất động đầu và cổ',
        detail:
          'Hai tay giữ chặt hai bên đầu nạn nhân, giữ trục đầu - cổ - thân mình trên một đường thẳng tuyệt đối.',
      },
      {
        title: 'Giữ nguyên hiện trường',
        detail: 'Không di chuyển nạn nhân trừ khi có nguy cơ cháy nổ trực tiếp đe dọa tính mạng.',
      },
      {
        title: 'Nếu nạn nhân đội mũ bảo hiểm',
        detail:
          'Không tự ý tháo mũ bảo hiểm nếu không có 2 người phối hợp và được huấn luyện chuyên môn.',
      },
    ],
    dos: ['Cố định trục thẳng đầu - cổ - thân', 'Đắp chăn ấm giữ nhiệt cho nạn nhân'],
    donts: [
      'TUYỆT ĐỐI KHÔNG bế thốc nách, gập cổ hoặc cõng nạn nhân',
      'Không cho nạn nhân ngồi dậy hay quay lắc đầu',
    ],
    warning:
      'Di chuyển sai tư thế có thể gây đứt tủy sống dẫn đến liệt toàn thân vĩnh viễn hoặc tử vong.',
    order: 3,
  },
  {
    id: 'bleeding',
    title: '4. Xử lý chảy máu & vết thương hở',
    summary: 'Cầm máu nhanh để ngăn ngừa sốc mất máu',
    icon: 'Droplet',
    priorityBadge: 'Cần xử lý ngay',
    steps: [
      {
        title: 'Ấn trực tiếp lên vết thương',
        detail:
          'Dùng miếng gạc sạch, khăn sạch hoặc lòng bàn tay ép chặt trực tiếp lên vết thương đang phun máu.',
      },
      {
        title: 'Băng ép cầm máu',
        detail:
          'Dùng băng cuộn quấn quanh vết thương vừa đủ chặt để cầm máu, nhưng vẫn đảm bảo máu lưu thông ở đầu chi.',
      },
      {
        title: 'Nâng cao chi bị thương',
        detail: 'Nâng phần chi bị chảy máu cao hơn mức tim (nếu không nghi ngờ gãy xương).',
      },
      {
        title: 'Trường hợp có dị vật đâm xuyên',
        detail:
          'Tuyệt đối KHÔNG rút dị vật ra. Chèn gạc xung quanh để cố định dị vật rồi băng vòng qua dị vật.',
      },
    ],
    dos: ['Giữ vết thương sạch sẽ', 'Dùng găng tay hoặc túi nilon ngăn tiếp xúc máu nếu có thể'],
    donts: ['Không rút dị vật (dao, thanh sắt, kính vỡ) ra khỏi vết thương'],
    order: 4,
  },
  {
    id: 'choking',
    title: '5. Hóc dị vật đường thở (Thủ thuật Heimlich)',
    summary: 'Nạn nhân nghẹt thở, hai tay ôm cổ, không nói hoặc ho được',
    icon: 'AlertOctagon',
    priorityBadge: 'Khẩn cấp',
    steps: [
      {
        title: 'Vỗ lưng (5 lần)',
        detail:
          'Đứng nghiêng ra phía sau nạn nhân, một tay đỡ ngực họ và cúi người về phía trước. Dùng gót bàn tay kia vỗ mạnh 5 lần vào lưng giữa hai bả vai.',
      },
      {
        title: 'Ép bụng Heimlich (5 lần)',
        detail:
          'Đứng sau lưng nạn nhân, vòng hai tay ôm eo họ. Nắm một tay thành quả đấm đặt phía trên rốn, dưới mũi ức. Tay kia bọc quả đấm, giật mạnh theo hướng vào trong và lên trên.',
      },
      {
        title: 'Lặp lại chu kỳ',
        detail:
          'Xen kẽ 5 lần vỗ lưng và 5 lần ép bụng cho tới khi dị vật bật ra ngoài hoặc nạn nhân thở lại.',
      },
    ],
    dos: ['Khuyến khích nạn nhân ho mạnh nếu họ vẫn ho được'],
    donts: ['Không dùng ngón tay móc mù vào họng vì có thể đẩy dị vật sâu hơn'],
    order: 5,
  },
  {
    id: 'burn',
    title: '6. Sơ cứu bỏng nhiệt',
    summary: 'Giảm độ sâu bỏng và ngăn ngừa nhiễm trùng',
    icon: 'Flame',
    steps: [
      {
        title: 'Làm mát dưới vòi nước chảy',
        detail:
          'Xả nước sạch mát (15 - 25°C) lên vùng bỏng liên tục trong 15 - 20 phút ngay sau khi bị bỏng.',
      },
      {
        title: 'Tháo bỏ đồ trang sức, quần áo',
        detail:
          'Nhẹ nhàng cởi bỏ nhẫn, đồng hồ, giày trước khi vùng bỏng bị sưng phù. Nếu quần áo dính vào da thịt thì KHÔNG giật ra mà cắt xung quanh.',
      },
      {
        title: 'Che phủ vết bỏng',
        detail:
          'Dùng gạc vô trùng hoặc màng bọc thực phẩm sạch che nhẹ lên vết bỏng để tránh nhiễm khuẩn.',
      },
    ],
    dos: ['Làm mát bằng nước sạch càng sớm càng tốt trong vòng 30 phút đầu'],
    donts: [
      'Không dùng nước đá lạnh hoặc chườm đá trực tiếp gây bỏng lạnh hoại tử da',
      'Không bôi kem đánh răng, nước mắm, mỡ trăn, lá cây lên vết bỏng',
      'Không làm vỡ các bọng nước trên da',
    ],
    order: 6,
  },
];

export const DEFAULT_MEDICAL_CONDITIONS: MedicalCondition[] = [
  {
    id: 'trauma',
    name: 'Chấn thương & Tai nạn thông thường',
    description: 'Quy trình DRCAB, ép tim CPR, cố định cột sống cổ, cầm máu, bỏng, hóc dị vật',
    icon: 'Bone',
    severity: 'medium',
    order: 1,
    topics: DEFAULT_FIRST_AID_TOPICS,
  },
  {
    id: 'epilepsy',
    name: 'Động kinh & Co giật',
    description: 'Cơn co giật toàn thân, sùi bọt mép, mất ý thức đột ngột',
    icon: 'Activity',
    severity: 'high',
    order: 2,
    topics: [
      {
        id: 'epilepsy-seizure',
        title: '1. Xử lý khi người bệnh lên cơn co giật',
        summary: 'Bảo vệ an toàn vùng đầu, không kìm kẹp nạn nhân',
        icon: 'Activity',
        priorityBadge: 'Cực kỳ khẩn cấp',
        steps: [
          {
            title: 'Kê vật mềm dưới đầu',
            detail:
              'Đặt áo khoác, gối hoặc túi mềm dưới đầu bệnh nhân để tránh va đập mạnh xuống sàn gây chấn thương sọ não.',
          },
          {
            title: 'Dọn dẹp vật sắc nhọn',
            detail:
              'Gạt bỏ ngay các vật cứng, sắc nhọn, bàn ghế, đồ thủy tinh xung quanh nạn nhân trong bán kính 2 mét.',
          },
          {
            title: 'Nới lỏng quần áo',
            detail:
              'Mở rộng cúc áo cổ, tháo cà vạt, nới thắt lưng để lồng ngực và đường thở được giải phóng hoàn toàn.',
          },
          {
            title: 'Ghi lại thời gian cơn giật',
            detail:
              'Bấm giờ bắt đầu và kết thúc cơn co giật. Nếu cơn giật kéo dài trên 5 phút, lập tức gọi Cấp cứu 115.',
          },
        ],
        dos: [
          'Ở bên cạnh nạn nhân cho đến khi cơn co giật kết thúc',
          'Gọi 115 nếu co giật kéo dài trên 5 phút hoặc xảy ra cơn thứ 2 liên tiếp',
        ],
        donts: [
          'TUYỆT ĐỐI KHÔNG nhét bất cứ vật gì (thìa, ngón tay, khăn) vào miệng nạn nhân',
          'KHÔNG ghì chặt, kìm kẹp hoặc cố giữ tay chân bệnh nhân',
          'KHÔNG cho uống nước hay uống thuốc khi bệnh nhân chưa tỉnh táo hoàn toàn',
        ],
        warning:
          'Nhét vật cứng vào miệng có thể làm gãy răng, rách lợi hoặc trượt dị vật vào đường thở gây ngạt thở tử vong.',
        order: 1,
      },
      {
        id: 'epilepsy-recovery',
        title: '2. Tư thế nằm nghiêng an toàn (Tư thế hồi phục)',
        summary: 'Thực hiện ngay sau khi cơn co giật dừng lại',
        icon: 'HeartPulse',
        priorityBadge: 'Quan trọng',
        steps: [
          {
            title: 'Đặt bệnh nhân nằm nghiêng',
            detail:
              'Gập nhẹ một chân và nghiêng người nạn nhân sang một bên để đờm dãi, chất nôn tự chảy ra ngoài, tránh hít sặc vào phổi.',
          },
          {
            title: 'Nâng nhẹ cằm',
            detail: 'Giữ cằm hơi ngửa để đường thở luôn thông suốt, kiểm tra nhịp thở đều đặn.',
          },
          {
            title: 'Trấn an tinh thần',
            detail:
              'Khi nạn nhân tỉnh lại, nói chuyện nhẹ nhàng giải thích những gì vừa xảy ra vì họ thường bị lú lẫn, mệt mỏi và mất phương hướng.',
          },
        ],
        dos: [
          'Luôn kiểm tra nhịp thở sau cơn co giật',
          'Giữ không gian yên tĩnh, thoáng khí cho nạn nhân nghỉ ngơi',
        ],
        donts: ['Không lay giật hay gọi to làm nạn nhân hoảng loạn'],
        order: 2,
      },
    ],
  },
  {
    id: 'asthma',
    name: 'Hen suyễn & Hen phế quản',
    description: 'Cơn khó thở kịch phát, thở rít, co kéo lồng ngực, môi tím tái',
    icon: 'Wind',
    severity: 'high',
    order: 3,
    topics: [
      {
        id: 'asthma-attack',
        title: '1. Xử trí cơn hen suyễn cấp tính',
        summary: 'Tư thế ngồi thẳng và hỗ trợ dùng bình xịt cắt cơn ngay lập tức',
        icon: 'Wind',
        priorityBadge: 'Khẩn cấp',
        steps: [
          {
            title: 'Tư thế ngồi thẳng lưng',
            detail:
              'Để bệnh nhân ngồi thẳng, hơi cúi người về phía trước, hai tay chống lên gối hoặc bàn. TUYỆT ĐỐI KHÔNG để nạn nhân nằm ngửa.',
          },
          {
            title: 'Dùng bình xịt cắt cơn (Ventolin / Salbutamol)',
            detail:
              'Lắc đều bình xịt, xịt 2 - 4 nhát vào miệng hít sâu, nín thở trong 5 - 10 giây trước khi thở ra từ từ.',
          },
          {
            title: 'Chờ 4 phút và đánh giá',
            detail:
              'Đợi 4 phút sau lần xịt đầu. Nếu chưa đỡ khó thở, tiếp tục xịt thêm 4 nhát nữa.',
          },
          {
            title: 'Gọi ngay Cấp cứu 115',
            detail:
              'Nếu sau 2 lần dùng thuốc bệnh nhân vẫn khó thở dữ dội, không nói được cả câu hoặc môi, móng tay tím tái.',
          },
        ],
        dos: [
          'Giữ không khí xung quanh thoáng đãng, tránh khói thuốc, bụi, mùi hóa chất',
          'Động viên bệnh nhân thở chậm và sâu, giữ bình tĩnh',
        ],
        donts: [
          'Không cho bệnh nhân nằm phẳng vì sẽ làm nghẹt thở nặng hơn',
          'Không tụ tập đông người che chắn không khí thở',
        ],
        warning:
          'Cơn hen suyễn ác tính có thể gây suy hô hấp cấp đe dọa tính mạng nếu không được cấp cứu kịp thời.',
        order: 1,
      },
    ],
  },
  {
    id: 'cardiovascular',
    name: 'Bệnh tim mạch & Đột quỵ tim',
    description: 'Đau thắt ngực dữ dội, lan lên hàm/vai trái, vã mồ hôi, khó thở',
    icon: 'HeartPulse',
    severity: 'critical',
    order: 4,
    topics: [
      {
        id: 'cardio-infarction',
        title: '1. Cấp cứu nhồi máu cơ tim & Đau thắt ngực',
        summary: 'Thời gian là vàng để cứu tế bào cơ tim',
        icon: 'HeartPulse',
        priorityBadge: 'Tối khẩn cấp',
        steps: [
          {
            title: 'Ngừng ngay mọi hoạt động',
            detail:
              'Cho bệnh nhân ngồi tựa lưng góc 45 độ hoặc nửa nằm nửa ngồi, thả lỏng toàn bộ cơ thể.',
          },
          {
            title: 'Gọi 115 ngay lập tức',
            detail:
              'Báo rõ thông tin: Nghi ngờ người bệnh bị nhồi máu cơ tim cấp để xe cứu thương trang bị máy khử rung tim (AED).',
          },
          {
            title: 'Hỗ trợ dùng thuốc cá nhân',
            detail:
              'Nếu bệnh nhân có sẵn thuốc Nitroglycerin ngậm dưới lưỡi hoặc Aspirin (theo đơn bác sĩ chuyên khoa tim mạch).',
          },
          {
            title: 'Chuẩn bị ép tim CPR',
            detail:
              'Nếu bệnh nhân bất tỉnh, ngừng thở hoặc thở ngáp cá, lập tức tiến hành ép tim liên tục 100-120 nhịp/phút.',
          },
        ],
        dos: [
          'Nới rộng cổ áo, thắt lưng, mở cửa sổ thoáng khí',
          'Đo huyết áp và nhịp tim nếu có thiết bị',
        ],
        donts: ['Không để bệnh nhân tự đi lại hay gắng sức', 'Không xoa dầu nóng hay cạo gió'],
        warning:
          'Cơn đau ngực kéo dài trên 15 phút không giảm khi nghỉ ngơi là dấu hiệu đe dọa tính mạng.',
        order: 1,
      },
    ],
  },
  {
    id: 'stroke',
    name: 'Đột quỵ não (Tai biến mạch máu não)',
    description: 'Méo miệng, yếu liệt một bên tay chân, nói khó (Quy tắc FAST)',
    icon: 'AlertOctagon',
    severity: 'critical',
    order: 5,
    topics: [
      {
        id: 'stroke-fast',
        title: '1. Nhận diện và xử trí đột quỵ não (Quy tắc FAST)',
        summary: 'Nhận biết triệu chứng trong khung giờ vàng 3 - 4.5 giờ',
        icon: 'AlertOctagon',
        priorityBadge: 'Tối khẩn cấp',
        steps: [
          {
            title: 'F - Face (Khuôn mặt)',
            detail:
              'Yêu cầu bệnh nhân cười: một bên khóe miệng bị xệ xuống hoặc méo lệch sang một bên.',
          },
          {
            title: 'A - Arms (Tay chân)',
            detail:
              'Yêu cầu giơ hai tay lên cao: một bên tay yếu dần và rơi xuống hoặc không nâng lên được.',
          },
          {
            title: 'S - Speech (Lời nói)',
            detail:
              'Yêu cầu lặp lại một câu ngắn đơn giản: giọng nói ngọng, líu lưỡi, không nói được hoặc không hiểu lời nói.',
          },
          {
            title: 'T - Time (Thời gian gọi 115)',
            detail:
              'Nếu xuất hiện 1 trong 3 dấu hiệu trên, gọi ngay Cấp cứu 115 và ghi nhớ chính xác thời điểm triệu chứng bắt đầu.',
          },
        ],
        dos: [
          'Đặt bệnh nhân nằm nghiêng an toàn nếu nôn ói, kê đầu cao 30 độ',
          'Giữ thông thoáng đường thở và trấn an người bệnh',
        ],
        donts: [
          'TUYỆT ĐỐI KHÔNG chích máu đầu ngón tay hay dái tai',
          'KHÔNG cho uống thuốc hạ huyết áp, viên An Cung hay bất kỳ đồ ăn nước uống nào',
          'KHÔNG cạo gió, bấm huyệt làm mất thời gian vàng cứu não',
        ],
        warning: 'Tự ý cho uống nước hoặc thuốc có thể gây sặc tắc đường thở tử vong ngay tại chỗ.',
        order: 1,
      },
    ],
  },
  {
    id: 'diabetes',
    name: 'Đái tháo đường & Hạ đường huyết',
    description: 'Run rẩy, vã mồ hôi lạnh, hoa mắt, đói cồn cào, lơ mơ',
    icon: 'Droplet',
    severity: 'medium',
    order: 6,
    topics: [
      {
        id: 'diabetes-hypo',
        title: '1. Xử lý cấp cứu hạ đường huyết',
        summary: 'Áp dụng quy tắc 15-15 bổ sung đường nhanh chóng',
        icon: 'Droplet',
        priorityBadge: 'Cần xử lý ngay',
        steps: [
          {
            title: 'Bổ sung đường nhanh (Nếu còn tỉnh)',
            detail:
              'Cho uống ngay 1/2 cốc nước đường ấm, nước ngọt có ga, nước ép trái cây hoặc ngậm 3 - 4 viên kẹo ngọt.',
          },
          {
            title: 'Nghỉ ngơi 15 phút',
            detail:
              'Đo lại chỉ số đường huyết mao mạch hoặc kiểm tra triệu chứng. Nếu vẫn mệt và đường huyết < 70 mg/dL, tiếp tục bổ sung thêm 1 lần nữa.',
          },
          {
            title: 'Ăn bữa phụ duy trì',
            detail:
              'Sau khi tỉnh táo, cho bệnh nhân ăn một mẩu bánh mì hoặc sữa chua để duy trì lượng đường huyết ổn định.',
          },
          {
            title: 'Nếu bệnh nhân hôn mê / bất tỉnh',
            detail:
              'Đặt nạn nhân nằm nghiêng an toàn, TUYỆT ĐỐI KHÔNG đổ nước vào miệng và gọi ngay Cấp cứu 115.',
          },
        ],
        dos: ['Luôn mang theo viên kẹo hoặc gói đường nhỏ trong người'],
        donts: ['Không cố ép người bất tỉnh nuốt nước hay thức ăn vì gây sặc phổi'],
        order: 1,
      },
    ],
  },
  {
    id: 'allergy',
    name: 'Dị ứng nặng & Sốc phản vệ',
    description: 'Nổi mề đay toàn thân, phù môi/mắt, khó thở, tụt huyết áp',
    icon: 'ShieldAlert',
    severity: 'critical',
    order: 7,
    topics: [
      {
        id: 'anaphylaxis-rescue',
        title: '1. Cấp cứu sốc phản vệ nguy kịch',
        summary: 'Sử dụng bút tiêm tự động Adrenaline / EpiPen ngay lập tức',
        icon: 'ShieldAlert',
        priorityBadge: 'Tối khẩn cấp',
        steps: [
          {
            title: 'Ngừng tiếp xúc dị nguyên',
            detail:
              'Ngừng ngay thức ăn nghi ngờ, thuốc đang truyền hoặc gạt bỏ ngòi ong đốt (nếu có).',
          },
          {
            title: 'Tiêm bắp Adrenaline (EpiPen)',
            detail:
              'Nếu bệnh nhân có sẵn bút tiêm Adrenaline tự động: Áp đầu bút vuông góc vào mặt trước ngoài đùi, ấn mạnh cho đến khi nghe tiếng tách và giữ trong 10 giây.',
          },
          {
            title: 'Gọi ngay Cấp cứu 115',
            detail:
              'Báo rõ cho tổng đài cấp cứu: Người bệnh đang bị sốc phản vệ nặng cần hỗ trợ y tế khẩn cấp.',
          },
          {
            title: 'Tư thế nằm an toàn',
            detail:
              'Để bệnh nhân nằm ngửa nâng cao hai chân 30-40 cm để dồn máu về tim và não. Nếu nôn ói cho nằm nghiêng, nếu khó thở cho ngồi tựa lưng.',
          },
        ],
        dos: [
          'Theo dõi sát nhịp thở và sắc mặt của nạn nhân',
          'Có thể tiêm liều Adrenaline thứ 2 sau 5-15 phút nếu triệu chứng không thuyên giảm và xe cấp cứu chưa tới',
        ],
        donts: ['Không cho bệnh nhân đứng dậy hoặc đi lại đột ngột vì có thể trụy mạch tử vong'],
        warning:
          'Sốc phản vệ diễn tiến cực kỳ nhanh, tiêm Adrenaline sớm là biện pháp sống còn duy nhất.',
        order: 1,
      },
    ],
  },
];

function emitMedicalContentChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EVENT_MEDICAL_CONTENT_CHANGED));
  }
}

// ---------------------------------------------------------
// Disclaimer Storage
// ---------------------------------------------------------

export function getDisclaimerData(): DisclaimerData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DISCLAIMER);
    if (!raw) return DEFAULT_DISCLAIMER_DATA;
    const parsed = JSON.parse(raw) as DisclaimerData;
    if (parsed && Array.isArray(parsed.items) && parsed.title) {
      return parsed;
    }
  } catch {
    // localStorage parse failed or disabled
  }
  return DEFAULT_DISCLAIMER_DATA;
}

export function saveDisclaimerData(data: DisclaimerData): void {
  try {
    const toSave: DisclaimerData = { ...data, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY_DISCLAIMER, JSON.stringify(toSave));
    emitMedicalContentChange();
    void updateMedicalContent({ disclaimer: toSave }).catch(() => {});
  } catch {
    // localStorage unavailable
  }
}

export function resetDisclaimerData(): DisclaimerData {
  try {
    localStorage.removeItem(STORAGE_KEY_DISCLAIMER);
    emitMedicalContentChange();
    void updateMedicalContent({ disclaimer: DEFAULT_DISCLAIMER_DATA }).catch(() => {});
  } catch {
    // ignore
  }
  return DEFAULT_DISCLAIMER_DATA;
}

// ---------------------------------------------------------
// Medical Conditions CRUD Storage
// ---------------------------------------------------------

export function getMedicalConditions(): MedicalCondition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONDITIONS);
    if (!raw) return DEFAULT_MEDICAL_CONDITIONS;
    const parsed = JSON.parse(raw) as MedicalCondition[];
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => a.order - b.order);
    }
  } catch {
    // ignore
  }
  return DEFAULT_MEDICAL_CONDITIONS;
}

export function saveMedicalConditions(conditions: MedicalCondition[]): void {
  try {
    const sorted = [...conditions].sort((a, b) => a.order - b.order);
    localStorage.setItem(STORAGE_KEY_CONDITIONS, JSON.stringify(sorted));
    emitMedicalContentChange();
    void updateMedicalContent({ conditions: sorted }).catch(() => {});
  } catch {
    // ignore
  }
}

export function resetMedicalConditions(): MedicalCondition[] {
  try {
    localStorage.removeItem(STORAGE_KEY_CONDITIONS);
    emitMedicalContentChange();
    void updateMedicalContent({ conditions: DEFAULT_MEDICAL_CONDITIONS }).catch(() => {});
  } catch {
    // ignore
  }
  return DEFAULT_MEDICAL_CONDITIONS;
}

export function getMedicalCondition(id: string): MedicalCondition | undefined {
  const conditions = getMedicalConditions();
  return conditions.find((c) => c.id === id);
}

export function saveMedicalCondition(condition: MedicalCondition): void {
  const conditions = getMedicalConditions();
  const exists = conditions.some((c) => c.id === condition.id);
  const next = exists
    ? conditions.map((c) => (c.id === condition.id ? condition : c))
    : [...conditions, condition];
  saveMedicalConditions(next);
}

export function deleteMedicalCondition(id: string): void {
  const conditions = getMedicalConditions();
  const next = conditions.filter((c) => c.id !== id);
  saveMedicalConditions(next);
}

// ---------------------------------------------------------
// First Aid Topics per Condition Storage
// ---------------------------------------------------------

export function saveTopicForCondition(conditionId: string, topic: FirstAidTopic): void {
  const conditions = getMedicalConditions();
  const target = conditions.find((c) => c.id === conditionId);
  if (!target) return;

  const topicExists = target.topics.some((t) => t.id === topic.id);
  const updatedTopics = topicExists
    ? target.topics.map((t) => (t.id === topic.id ? topic : t))
    : [...target.topics, topic];
  updatedTopics.sort((a, b) => a.order - b.order);

  const updatedConditions = conditions.map((c) =>
    c.id === conditionId ? { ...c, topics: updatedTopics } : c,
  );
  saveMedicalConditions(updatedConditions);
}

export function deleteTopicFromCondition(conditionId: string, topicId: string): void {
  const conditions = getMedicalConditions();
  const updatedConditions = conditions.map((c) =>
    c.id === conditionId ? { ...c, topics: c.topics.filter((t) => t.id !== topicId) } : c,
  );
  saveMedicalConditions(updatedConditions);
}

export function resetTopicsForCondition(conditionId: string): void {
  const defaultCondition = DEFAULT_MEDICAL_CONDITIONS.find((c) => c.id === conditionId);
  if (!defaultCondition) return;

  const conditions = getMedicalConditions();
  const updatedConditions = conditions.map((c) =>
    c.id === conditionId ? { ...c, topics: defaultCondition.topics } : c,
  );
  saveMedicalConditions(updatedConditions);
}

// ---------------------------------------------------------
// Flat First Aid Topics (Backwards Compatibility & Direct Access)
// ---------------------------------------------------------

export function getFirstAidTopics(conditionId?: string): FirstAidTopic[] {
  if (conditionId) {
    const condition = getMedicalCondition(conditionId);
    if (condition) return condition.topics;
    return [];
  }

  // Check flat legacy storage first
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FIRST_AID);
    if (raw) {
      const parsed = JSON.parse(raw) as FirstAidTopic[];
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => a.order - b.order);
      }
    }
  } catch {
    // ignore
  }

  // Fallback to trauma condition or default topics
  const trauma = getMedicalCondition('trauma');
  if (trauma && trauma.topics.length > 0) {
    return trauma.topics;
  }
  return DEFAULT_FIRST_AID_TOPICS;
}

export function saveFirstAidTopics(topics: FirstAidTopic[], conditionId?: string): void {
  if (conditionId) {
    const conditions = getMedicalConditions();
    const updated = conditions.map((c) =>
      c.id === conditionId ? { ...c, topics: [...topics].sort((a, b) => a.order - b.order) } : c,
    );
    saveMedicalConditions(updated);
    return;
  }

  try {
    const sorted = [...topics].sort((a, b) => a.order - b.order);
    localStorage.setItem(STORAGE_KEY_FIRST_AID, JSON.stringify(sorted));
    // Also sync to trauma condition for consistency
    const conditions = getMedicalConditions();
    const updated = conditions.map((c) => (c.id === 'trauma' ? { ...c, topics: sorted } : c));
    localStorage.setItem(STORAGE_KEY_CONDITIONS, JSON.stringify(updated));
    emitMedicalContentChange();
  } catch {
    // ignore
  }
}

export function resetFirstAidTopics(conditionId?: string): FirstAidTopic[] {
  if (conditionId) {
    resetTopicsForCondition(conditionId);
    return getFirstAidTopics(conditionId);
  }

  try {
    localStorage.removeItem(STORAGE_KEY_FIRST_AID);
    emitMedicalContentChange();
  } catch {
    // ignore
  }
  return DEFAULT_FIRST_AID_TOPICS;
}

// ---------------------------------------------------------
// User Condition Mapping
// ---------------------------------------------------------

export function getUserCondition(userKey?: string): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER_CONDITIONS);
    if (!raw) return null;
    const mapping = JSON.parse(raw) as Record<string, string>;
    if (userKey && mapping[userKey]) {
      return mapping[userKey];
    }
    // Return default active condition if userKey is not specified
    return mapping['current_user'] || null;
  } catch {
    return null;
  }
}

export function setUserCondition(userKey: string, conditionId: string | null): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER_CONDITIONS);
    const mapping = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    if (conditionId) {
      mapping[userKey] = conditionId;
    } else {
      delete mapping[userKey];
    }
    localStorage.setItem(STORAGE_KEY_USER_CONDITIONS, JSON.stringify(mapping));
    emitMedicalContentChange();
    void updateMedicalContent({ userConditions: mapping }).catch(() => {});
  } catch {
    // ignore
  }
}

let syncPromise: Promise<void> | null = null;

export function initMedicalContentSync(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (syncPromise) return syncPromise;

  syncPromise = fetchMedicalContent()
    .then((payload) => {
      let changed = false;
      const localConditionsRaw = localStorage.getItem(STORAGE_KEY_CONDITIONS);
      if (
        payload.conditions &&
        Array.isArray(payload.conditions) &&
        payload.conditions.length > 0
      ) {
        localStorage.setItem(STORAGE_KEY_CONDITIONS, JSON.stringify(payload.conditions));
        changed = true;
      } else if (localConditionsRaw) {
        try {
          const localParsed = JSON.parse(localConditionsRaw) as MedicalCondition[];
          void updateMedicalContent({ conditions: localParsed }).catch(() => {});
        } catch {
          // ignore
        }
      }

      const localDisclaimerRaw = localStorage.getItem(STORAGE_KEY_DISCLAIMER);
      if (payload.disclaimer && typeof payload.disclaimer === 'object') {
        localStorage.setItem(STORAGE_KEY_DISCLAIMER, JSON.stringify(payload.disclaimer));
        changed = true;
      } else if (localDisclaimerRaw) {
        try {
          const localParsed = JSON.parse(localDisclaimerRaw) as DisclaimerData;
          void updateMedicalContent({ disclaimer: localParsed }).catch(() => {});
        } catch {
          // ignore
        }
      }

      const localUserConditionsRaw = localStorage.getItem(STORAGE_KEY_USER_CONDITIONS);
      if (payload.userConditions && typeof payload.userConditions === 'object') {
        localStorage.setItem(STORAGE_KEY_USER_CONDITIONS, JSON.stringify(payload.userConditions));
        changed = true;
      } else if (localUserConditionsRaw) {
        try {
          const localParsed = JSON.parse(localUserConditionsRaw) as Record<string, string>;
          void updateMedicalContent({ userConditions: localParsed }).catch(() => {});
        } catch {
          // ignore
        }
      }

      if (changed) {
        emitMedicalContentChange();
      }
    })
    .catch(() => {
      // Offline fallback: keep local data
    });

  return syncPromise;
}

// ---------------------------------------------------------
// Reactive Hooks
// ---------------------------------------------------------

export function useDisclaimerContent() {
  const [data, setData] = useState<DisclaimerData>(getDisclaimerData);

  useEffect(() => {
    void initMedicalContentSync();
    const handler = () => setData(getDisclaimerData());
    window.addEventListener(EVENT_MEDICAL_CONTENT_CHANGED, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_MEDICAL_CONTENT_CHANGED, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const save = (updated: DisclaimerData) => {
    saveDisclaimerData(updated);
    setData(updated);
  };

  const reset = () => {
    const defaults = resetDisclaimerData();
    setData(defaults);
  };

  const addItem = (item: Omit<DisclaimerData['items'][number], 'id'>) => {
    const newItem = { ...item, id: `disclaimer-${Date.now()}` };
    const updated = { ...data, items: [...data.items, newItem] };
    save(updated);
  };

  const updateItem = (
    id: string,
    updates: Partial<Omit<DisclaimerData['items'][number], 'id'>>,
  ) => {
    const updated = {
      ...data,
      items: data.items.map((it) => (it.id === id ? { ...it, ...updates } : it)),
    };
    save(updated);
  };

  const deleteItem = (id: string) => {
    const updated = {
      ...data,
      items: data.items.filter((it) => it.id !== id),
    };
    save(updated);
  };

  return {
    disclaimer: data,
    save,
    reset,
    addItem,
    updateItem,
    deleteItem,
  };
}

export function useMedicalConditions() {
  const [conditions, setConditions] = useState<MedicalCondition[]>(getMedicalConditions);

  useEffect(() => {
    void initMedicalContentSync();
    const handler = () => setConditions(getMedicalConditions());
    window.addEventListener(EVENT_MEDICAL_CONTENT_CHANGED, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_MEDICAL_CONTENT_CHANGED, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const saveCondition = (condition: MedicalCondition) => {
    saveMedicalCondition(condition);
    setConditions(getMedicalConditions());
  };

  const deleteCondition = (id: string) => {
    deleteMedicalCondition(id);
    setConditions(getMedicalConditions());
  };

  const resetConditions = () => {
    const defaults = resetMedicalConditions();
    setConditions(defaults);
  };

  return {
    conditions,
    saveCondition,
    deleteCondition,
    resetConditions,
  };
}

export function useFirstAidContent(conditionId?: string) {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    void initMedicalContentSync();
    const handler = () => setRevision((r) => r + 1);
    window.addEventListener(EVENT_MEDICAL_CONTENT_CHANGED, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_MEDICAL_CONTENT_CHANGED, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const topics = useMemo(() => {
    void revision;
    return getFirstAidTopics(conditionId);
  }, [conditionId, revision]);

  const saveTopic = (topic: FirstAidTopic) => {
    if (conditionId) {
      saveTopicForCondition(conditionId, topic);
      setRevision((r) => r + 1);
      return;
    }
    const exists = topics.some((t) => t.id === topic.id);
    let next: FirstAidTopic[];
    if (exists) {
      next = topics.map((t) => (t.id === topic.id ? topic : t));
    } else {
      next = [...topics, topic];
    }
    next.sort((a, b) => a.order - b.order);
    saveFirstAidTopics(next);
    setRevision((r) => r + 1);
  };

  const deleteTopic = (id: string) => {
    if (conditionId) {
      deleteTopicFromCondition(conditionId, id);
      setRevision((r) => r + 1);
      return;
    }
    const next = topics.filter((t) => t.id !== id);
    saveFirstAidTopics(next);
    setRevision((r) => r + 1);
  };

  const resetTopics = () => {
    if (conditionId) {
      resetTopicsForCondition(conditionId);
      setRevision((r) => r + 1);
      return;
    }
    resetFirstAidTopics();
    setRevision((r) => r + 1);
  };

  return {
    topics,
    saveTopic,
    deleteTopic,
    resetTopics,
  };
}

export function useUserCondition(userKey?: string) {
  const [conditionId, setConditionIdState] = useState<string | null>(() =>
    getUserCondition(userKey),
  );

  useEffect(() => {
    void initMedicalContentSync();
    const handler = () => setConditionIdState(getUserCondition(userKey));
    window.addEventListener(EVENT_MEDICAL_CONTENT_CHANGED, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_MEDICAL_CONTENT_CHANGED, handler);
      window.removeEventListener('storage', handler);
    };
  }, [userKey]);

  const setConditionId = (id: string | null) => {
    setUserCondition(userKey || 'current_user', id);
    setConditionIdState(id);
  };

  return {
    conditionId,
    setConditionId,
  };
}
