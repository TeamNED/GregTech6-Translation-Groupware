#include "DictGenerator.hpp"

DictGenerator::DictGenerator(shared_ptr<IGeneratorMeta> meta)
    : Generator(std::move(meta)) {}
DictGenerator::DictGenerator(shared_ptr<IGeneratorMeta> meta,
                             LangListPointer dict)
    : Generator(std::move(meta)), _dict(std::move(dict)) {}

LangListPointer &DictGenerator::dict() { return this->_dict; }
const LangListPointer &DictGenerator::dict() const { return this->_dict; }

vector<shared_ptr<ILangResult>>
DictGenerator::results(IGroupRepository *repo) const {
  auto result = std::make_shared<DictLangResult>(
      this->meta(), std::make_shared<LangList>(*(this->dict())));
  return vector<shared_ptr<ILangResult>>{result};
}