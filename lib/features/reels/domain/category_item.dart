class CategoryItem {
  final String id;
  final String name;
  final String slug;
  final String color;

  CategoryItem({
    required this.id,
    required this.name,
    required this.slug,
    required this.color,
  });

  factory CategoryItem.fromJson(Map<String, dynamic> json) {
    return CategoryItem(
      id: json['id'],
      name: json['name'],
      slug: json['slug'],
      color: json['color'] ?? '#000000',
    );
  }
}
